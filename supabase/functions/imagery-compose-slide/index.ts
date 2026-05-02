// Imagery Engine — Compose
// Recebe { slide_id, treated_image_url? } → renderiza template via Satori → SVG → PNG via Resvg.
// Salva como final_png_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import satori from "https://esm.sh/satori@0.10.13";
import { Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { corsHeaders } from "../_shared/cors.ts";
import { VS_LOGO_DATA_URL } from "./logo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Init Resvg WASM (one-time)
let resvgReady: Promise<void> | null = null;
async function initResvg() {
  if (!resvgReady) {
    resvgReady = (async () => {
      const wasm = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm").then(r => r.arrayBuffer());
      const { initWasm } = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
      await initWasm(wasm);
    })();
  }
  return resvgReady;
}

// Carrega Barlow Condensed Bold + Barlow Regular
let fontsCache: { name: string; data: ArrayBuffer; weight: number; style: "normal" }[] | null = null;
async function loadFonts() {
  if (fontsCache) return fontsCache;
  async function fetchFont(url: string): Promise<ArrayBuffer> {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) throw new Error(`font fetch ${url} -> ${r.status}`);
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("html")) throw new Error(`font fetch returned HTML: ${url}`);
    return await r.arrayBuffer();
  }
  const [bold, regular] = await Promise.all([
    fetchFont("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf"),
    fetchFont("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/barlow/Barlow-Regular.ttf"),
  ]);
  fontsCache = [
    { name: "Barlow Condensed", data: bold, weight: 700, style: "normal" },
    { name: "Barlow", data: regular, weight: 400, style: "normal" },
  ];
  return fontsCache;
}

const VS_BLUE = "#2E6FCC";
const VS_BLUE_LIGHT = "#4A8DE0";
const BLACK = "#0A0A0A";
const WHITE = "#FAFAFA";
const RED_PROBLEM = "#7A1F1F";

async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const r = await fetch(url);
    if (!r.ok) return undefined;
    const ct = r.headers.get("content-type") ?? "image/jpeg";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch { return undefined; }
}

async function finalizePostIfDone(admin: any, postId: string) {
  const { data: slides } = await admin.from("imagery_slides")
    .select("status").eq("post_id", postId);
  const total = slides?.length ?? 0;
  if (!total || !slides!.every((s: any) => ["ready", "failed"].includes(s.status))) return;

  const failed = slides!.filter((s: any) => s.status === "failed").length;
  const { data: logs } = await admin.from("imagery_logs")
    .select("custo_usd").eq("post_id", postId);
  const custoTotal = (logs ?? []).reduce((acc: number, l: any) => acc + Number(l.custo_usd ?? 0), 0);

  await admin.from("imagery_posts").update({
    status: failed === total ? "failed" : "ready",
    error_message: failed > 0 ? `${failed}/${total} slides com problema` : null,
    custo_total_usd: custoTotal,
  }).eq("id", postId);
}

async function processSlide(slide_id: string, treated_image_url: string | undefined, t0: number) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let postId: string | undefined;
  try {
    const { data: slide } = await admin.from("imagery_slides").select("*").eq("id", slide_id).single();
    if (!slide) throw new Error("slide não encontrado");
    postId = slide.post_id;
    await admin.from("imagery_slides").update({ status: "composing" }).eq("id", slide_id);

    const rawBg = treated_image_url ?? slide.treated_image_url ?? slide.raw_image_url ?? undefined;
    const bgUrl = rawBg ? await urlToDataUrl(rawBg) : undefined;
    const headline = (slide.copy_data?.headline as string) ?? "";
    const sub = (slide.copy_data?.sub_text as string) ?? "";

    const fonts = await loadFonts();
    await initResvg();

    const element = buildElement(slide.template_id, headline, sub, bgUrl);
    const svg = await satori(element, { width: 1080, height: 1080, fonts });

    const { Resvg: ResvgClass } = await import("https://esm.sh/@resvg/resvg-wasm@2.6.2");
    const resvg = new ResvgClass(svg, { fitTo: { mode: "width", value: 1080 } });
    const png = resvg.render().asPng();

    const path = `${slide.post_id}/${slide.id}_final_${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from("imagery").upload(path, png, {
      contentType: "image/png", upsert: true,
    });
    if (upErr) throw upErr;
    const { data: urlData } = admin.storage.from("imagery").getPublicUrl(path);
    const finalUrl = urlData.publicUrl;

    await admin.from("imagery_slides").update({
      final_png_url: finalUrl, status: "ready",
    }).eq("id", slide_id);

    await admin.from("imagery_logs").insert({
      slide_id, post_id: slide.post_id, step: "compose",
      provider: "satori", model: "resvg-wasm",
      response_summary: { final_url: finalUrl, template: slide.template_id },
      duracao_ms: Date.now() - t0, success: true,
    });
    await finalizePostIfDone(admin, slide.post_id);
  } catch (e: any) {
    console.error("processSlide error:", e);
    await admin.from("imagery_slides").update({
      status: "failed", error_message: String(e?.message ?? e).slice(0, 500),
    }).eq("id", slide_id);
    await admin.from("imagery_logs").insert({
      slide_id, step: "compose", provider: "satori", model: "resvg-wasm",
      success: false, error_message: String(e?.message ?? e).slice(0, 500),
      duracao_ms: Date.now() - t0,
    });
    if (postId) await finalizePostIfDone(admin, postId);
  }
}

function buildElement(template: string, headline: string, sub: string, bgUrl?: string): any {
  const headlineUpper = headline.toUpperCase();
  const baseStyle = {
    width: 1080, height: 1080,
    display: "flex", flexDirection: "column" as const,
    fontFamily: "Barlow Condensed",
    color: WHITE, position: "relative" as const,
  };

  // Helpers
  const handleEl = (color = "rgba(255,255,255,0.55)") => ({
    type: "div", props: {
      style: {
        position: "absolute", bottom: 56, right: 64,
        fontFamily: "Barlow", fontSize: 20, color, letterSpacing: 1, display: "flex",
      },
      children: "@VSSOLUCOES_",
    },
  });

  const logoEl = (top = 56, left = 64, height = 44) => ({
    type: "img", props: {
      src: VS_LOGO_DATA_URL,
      style: { position: "absolute", top, left, height, width: "auto" },
    },
  });

  // ===== T01 — CAPA HOOK GIGANTE =====
  if (template === "T01_HOOK_BIG_TEXT") {
    const hasBg = !!bgUrl;
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          hasBg ? { type: "img", props: { src: bgUrl!, style: { position: "absolute", inset: 0, width: 1080, height: 1080, objectFit: "cover", filter: "grayscale(100%) contrast(140%) brightness(70%)" } } } : null,
          hasBg ? { type: "div", props: { style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex" } } } : null,
          // Barra azul VS no topo
          { type: "div", props: { style: { position: "absolute", top: 0, left: 0, width: 1080, height: 12, background: VS_BLUE, display: "flex" } } },
          logoEl(56, 64, 40),
          // Headline gigante centro-esquerda
          { type: "div", props: {
            style: { position: "absolute", inset: 0, padding: "180px 64px 180px 64px", display: "flex", alignItems: "center" },
            children: { type: "div", props: {
              style: {
                fontFamily: "Barlow Condensed", fontWeight: 700,
                fontSize: headlineUpper.length > 30 ? 180 : 220,
                lineHeight: 0.88, letterSpacing: -4,
                color: WHITE, textTransform: "uppercase", display: "flex",
              },
              children: headlineUpper,
            } },
          } },
          // Faixa inferior @handle
          { type: "div", props: { style: { position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: BLACK, borderTop: `2px solid ${VS_BLUE}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px" } }, children: undefined },
          { type: "div", props: { style: { position: "absolute", bottom: 28, left: 64, fontFamily: "Barlow", fontSize: 22, color: WHITE, letterSpacing: 2, display: "flex" }, children: "ARRASTE →" } },
          handleEl(WHITE),
        ].filter(Boolean),
      },
    };
  }

  // ===== T03 — DATA POINT (NÚMERO GIGANTE) =====
  if (template === "T03_DATA_POINT") {
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          logoEl(56, 64, 36),
          { type: "div", props: { style: { position: "absolute", top: 56, right: 64, fontFamily: "Barlow", fontSize: 18, color: VS_BLUE_LIGHT, letterSpacing: 3, display: "flex" }, children: "// DADO" } },
          { type: "div", props: {
            style: { position: "absolute", inset: 0, padding: 64, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 32 },
            children: [
              { type: "div", props: {
                style: {
                  fontFamily: "Barlow Condensed", fontWeight: 700,
                  fontSize: headlineUpper.length > 4 ? 360 : 480,
                  lineHeight: 0.85, letterSpacing: -10, color: VS_BLUE_LIGHT, display: "flex",
                },
                children: headlineUpper,
              } },
              sub ? { type: "div", props: {
                style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 48, color: WHITE, textTransform: "uppercase", maxWidth: 900, lineHeight: 1.05, display: "flex", borderLeft: `6px solid ${VS_BLUE}`, paddingLeft: 24 },
                children: sub.toUpperCase(),
              } } : null,
            ].filter(Boolean),
          } },
          handleEl(),
        ].filter(Boolean),
      },
    };
  }

  // ===== T04 — BEFORE/AFTER (SPLIT) =====
  if (template === "T04_BEFORE_AFTER") {
    // headline esperado: "antes | depois" ou usa fallback
    const parts = headline.includes("|") ? headline.split("|") : ["ANTES", "DEPOIS"];
    const left = (parts[0] ?? "ANTES").trim().toUpperCase();
    const right = (parts[1] ?? "DEPOIS").trim().toUpperCase();
    return {
      type: "div", props: {
        style: { ...baseStyle, flexDirection: "row", background: BLACK },
        children: [
          // LEFT — problema
          { type: "div", props: {
            style: { width: 540, height: 1080, background: "#1A1A1A", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 48, position: "relative" },
            children: [
              { type: "div", props: { style: { position: "absolute", top: 56, fontFamily: "Barlow", fontSize: 20, color: "#888", letterSpacing: 4, display: "flex" }, children: "ANTES" } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 96, lineHeight: 0.95, color: "#888", textTransform: "uppercase", textAlign: "center", letterSpacing: -2, display: "flex" }, children: left } },
              { type: "div", props: { style: { position: "absolute", bottom: 56, width: 80, height: 6, background: RED_PROBLEM, display: "flex" } } },
            ],
          } },
          // RIGHT — solução VS
          { type: "div", props: {
            style: { width: 540, height: 1080, background: VS_BLUE, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 48, position: "relative" },
            children: [
              { type: "div", props: { style: { position: "absolute", top: 56, fontFamily: "Barlow", fontSize: 20, color: WHITE, letterSpacing: 4, display: "flex" }, children: "COM A VS" } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 96, lineHeight: 0.95, color: WHITE, textTransform: "uppercase", textAlign: "center", letterSpacing: -2, display: "flex" }, children: right } },
              { type: "div", props: { style: { position: "absolute", bottom: 56, width: 80, height: 6, background: WHITE, display: "flex" } } },
            ],
          } },
          // Sub na base se houver
          sub ? { type: "div", props: {
            style: { position: "absolute", bottom: 24, left: 0, right: 0, fontFamily: "Barlow", fontSize: 18, color: "rgba(255,255,255,0.6)", textAlign: "center", letterSpacing: 2, display: "flex", justifyContent: "center" },
            children: sub.toUpperCase(),
          } } : null,
        ].filter(Boolean),
      },
    };
  }

  // ===== T05 — PROCESS STEP (NÚMERO DA ETAPA) =====
  if (template === "T05_PROCESS_STEP") {
    // Tenta extrair "01" ou número do início
    const match = headline.match(/^(\d{1,2})/);
    const stepNumber = match ? match[1].padStart(2, "0") : "01";
    const stepText = headline.replace(/^\d{1,2}[\s.\-]*/, "").toUpperCase() || headlineUpper;
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          logoEl(56, 64, 36),
          { type: "div", props: { style: { position: "absolute", top: 56, right: 64, fontFamily: "Barlow", fontSize: 18, color: VS_BLUE_LIGHT, letterSpacing: 3, display: "flex" }, children: "// ETAPA" } },
          { type: "div", props: {
            style: { position: "absolute", inset: 0, padding: "64px 64px 120px 64px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" },
            children: [
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 600, lineHeight: 0.78, letterSpacing: -20, color: VS_BLUE, display: "flex" }, children: stepNumber } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 80, lineHeight: 0.95, color: WHITE, textTransform: "uppercase", letterSpacing: -1, marginTop: 16, maxWidth: 900, display: "flex" }, children: stepText } },
              sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 26, color: "rgba(255,255,255,0.7)", marginTop: 20, maxWidth: 800, display: "flex" }, children: sub } } : null,
            ].filter(Boolean),
          } },
          handleEl(),
        ].filter(Boolean),
      },
    };
  }

  // ===== T06 — QUOTE (CITAÇÃO EDITORIAL) =====
  if (template === "T06_QUOTE_FOUNDER") {
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          logoEl(56, 64, 36),
          { type: "div", props: {
            style: { position: "absolute", inset: 0, padding: 100, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 32 },
            children: [
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 200, lineHeight: 0.7, color: VS_BLUE, display: "flex" }, children: "\u201C" } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 80, lineHeight: 1.05, color: WHITE, maxWidth: 900, letterSpacing: -1, display: "flex" }, children: headline } },
              sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 22, color: VS_BLUE_LIGHT, letterSpacing: 3, marginTop: 8, display: "flex" }, children: `— ${sub.toUpperCase()}` } } : null,
            ].filter(Boolean),
          } },
          handleEl(),
        ].filter(Boolean),
      },
    };
  }

  // ===== T07 — SOLUTION REVEAL =====
  if (template === "T07_SOLUTION_REVEAL") {
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          logoEl(56, 64, 36),
          { type: "div", props: { style: { position: "absolute", top: 56, right: 64, fontFamily: "Barlow", fontSize: 18, color: VS_BLUE_LIGHT, letterSpacing: 3, display: "flex" }, children: "// SOLUÇÃO" } },
          { type: "div", props: {
            style: { position: "absolute", inset: 0, padding: 80, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 32 },
            children: [
              { type: "div", props: { style: { width: 120, height: 8, background: VS_BLUE, display: "flex" } } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 120, lineHeight: 0.92, color: WHITE, textTransform: "uppercase", letterSpacing: -2, maxWidth: 950, display: "flex" }, children: headlineUpper } },
              sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 30, color: "rgba(255,255,255,0.75)", maxWidth: 850, display: "flex" }, children: sub } } : null,
            ].filter(Boolean),
          } },
          handleEl(),
        ].filter(Boolean),
      },
    };
  }

  // ===== T08 — CTA FINAL (FUNDO VS BLUE) =====
  if (template === "T08_CTA_FINAL") {
    return {
      type: "div", props: {
        style: { ...baseStyle, background: VS_BLUE, justifyContent: "center", alignItems: "center", padding: 80 },
        children: [
          { type: "img", props: { src: VS_LOGO_DATA_URL, style: { position: "absolute", top: 80, height: 56, width: "auto" } } },
          { type: "div", props: {
            style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 32, textAlign: "center" },
            children: [
              { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 22, color: WHITE, letterSpacing: 6, opacity: 0.85, display: "flex" }, children: "// PRÓXIMO PASSO" } },
              { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 130, lineHeight: 0.92, color: WHITE, textTransform: "uppercase", letterSpacing: -2, maxWidth: 920, textAlign: "center", display: "flex" }, children: headlineUpper } },
              sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 28, color: "rgba(255,255,255,0.95)", marginTop: 16, maxWidth: 800, textAlign: "center", display: "flex" }, children: sub } } : null,
            ].filter(Boolean),
          } },
          { type: "div", props: { style: { position: "absolute", bottom: 64, fontFamily: "Barlow", fontSize: 20, color: WHITE, letterSpacing: 4, opacity: 0.85, display: "flex" }, children: "@VSSOLUCOES_" } },
        ],
      },
    };
  }

  // ===== DEFAULT — T02 PROBLEM (foto P&B + headline brutal embaixo) =====
  const hasBg = !!bgUrl;
  return {
    type: "div", props: {
      style: { ...baseStyle, background: BLACK },
      children: [
        hasBg ? { type: "img", props: { src: bgUrl!, style: { position: "absolute", inset: 0, width: 1080, height: 1080, objectFit: "cover", filter: "grayscale(100%) contrast(140%) brightness(60%)" } } } : null,
        // Overlay forte na metade inferior
        { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 75%)", display: "flex" } } },
        { type: "div", props: { style: { position: "absolute", top: 0, left: 0, width: 1080, height: 8, background: VS_BLUE, display: "flex" } } },
        logoEl(56, 64, 36),
        { type: "div", props: { style: { position: "absolute", top: 56, right: 64, fontFamily: "Barlow", fontSize: 18, color: VS_BLUE_LIGHT, letterSpacing: 3, display: "flex" }, children: "// PROBLEMA" } },
        { type: "div", props: {
          style: { position: "absolute", inset: 0, padding: "64px 64px 140px 64px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 24 },
          children: [
            { type: "div", props: { style: { width: 80, height: 6, background: VS_BLUE, display: "flex" } } },
            { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 110, lineHeight: 0.92, color: WHITE, textTransform: "uppercase", letterSpacing: -2, maxWidth: 950, display: "flex" }, children: headlineUpper } },
            sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 28, color: "rgba(255,255,255,0.8)", maxWidth: 800, display: "flex" }, children: sub } } : null,
          ].filter(Boolean),
        } },
        handleEl(),
      ].filter(Boolean),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { slide_id, treated_image_url } = await req.json();
    if (!slide_id) {
      return new Response(JSON.stringify({ error: "slide_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-expect-error EdgeRuntime is provided at runtime
    EdgeRuntime.waitUntil(processSlide(slide_id, treated_image_url, t0));

    return new Response(JSON.stringify({ accepted: true, slide_id }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imagery-compose-slide error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});