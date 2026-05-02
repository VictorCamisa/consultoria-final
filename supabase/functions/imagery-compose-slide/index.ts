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
    display: "flex", flexDirection: "column",
    fontFamily: "Barlow Condensed",
    color: "white", position: "relative" as const,
  };

  const bgLayer = bgUrl ? {
    type: "img", props: {
      src: bgUrl,
      style: { position: "absolute", top: 0, left: 0, width: 1080, height: 1080, objectFit: "cover" },
    },
  } : null;

  const overlay = {
    type: "div", props: {
      style: {
        position: "absolute", top: 0, left: 0, width: 1080, height: 1080,
        background: "linear-gradient(180deg, rgba(5,8,20,0.4) 0%, rgba(5,8,20,0.85) 100%)",
        display: "flex",
      },
    },
  };

  const logo = {
    type: "img", props: {
      src: VS_LOGO_DATA_URL,
      style: { position: "absolute", top: 48, left: 48, height: 56, width: "auto" },
    },
  };

  const handle = {
    type: "div", props: {
      style: {
        position: "absolute", bottom: 48, left: 48,
        fontFamily: "Barlow", fontSize: 22, color: "rgba(255,255,255,0.6)", display: "flex",
      },
      children: "@vssolucoes_",
    },
  };

  // Variants por template
  let content: any;
  switch (template) {
    case "T01_HOOK_BIG_TEXT":
      content = {
        type: "div", props: {
          style: {
            position: "absolute", inset: 0, padding: 80,
            display: "flex", alignItems: "center", justifyContent: "flex-start",
          },
          children: {
            type: "div", props: {
              style: {
                fontFamily: "Barlow Condensed", fontWeight: 700,
                fontSize: 160, lineHeight: 0.95, letterSpacing: -2,
                color: "white", textTransform: "uppercase", display: "flex",
              },
              children: headlineUpper,
            },
          },
        },
      };
      break;
    case "T03_DATA_POINT":
      content = {
        type: "div", props: {
          style: {
            position: "absolute", inset: 0, padding: 80,
            display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 24,
          },
          children: [
            { type: "div", props: { style: { fontSize: 240, fontWeight: 700, color: VS_BLUE_LIGHT, lineHeight: 1, display: "flex" }, children: headlineUpper } },
            sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 32, color: "rgba(255,255,255,0.85)", maxWidth: 800, display: "flex" }, children: sub } } : null,
          ].filter(Boolean),
        },
      };
      break;
    case "T08_CTA_FINAL":
      // Fundo VS Blue sólido, sem bgImage
      return {
        type: "div", props: {
          style: { ...baseStyle, background: VS_BLUE, alignItems: "center", justifyContent: "center", padding: 80 },
          children: [
            { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 110, lineHeight: 1, color: "white", textAlign: "center", display: "flex", textTransform: "uppercase", letterSpacing: -1 }, children: headlineUpper } },
            sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 32, color: "rgba(255,255,255,0.9)", marginTop: 32, maxWidth: 800, textAlign: "center", display: "flex" }, children: sub } } : null,
            { type: "img", props: { src: VS_LOGO_DATA_URL, style: { position: "absolute", bottom: 56, height: 56, width: "auto" } } },
            { type: "div", props: { style: { position: "absolute", bottom: 24, fontFamily: "Barlow", fontSize: 22, color: "rgba(255,255,255,0.85)", display: "flex" }, children: "@vssolucoes_" } },
          ].filter(Boolean),
        },
      };
    default:
      // T02, T04, T05, T06, T07 — layout padrão headline embaixo + sub
      content = {
        type: "div", props: {
          style: {
            position: "absolute", inset: 0, padding: 80,
            display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16,
          },
          children: [
            { type: "div", props: { style: { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 92, lineHeight: 0.98, color: "white", textTransform: "uppercase", letterSpacing: -1, maxWidth: 900, display: "flex" }, children: headlineUpper } },
            sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontSize: 30, color: "rgba(255,255,255,0.85)", maxWidth: 800, display: "flex" }, children: sub } } : null,
          ].filter(Boolean),
        },
      };
  }

  return {
    type: "div", props: {
      style: { ...baseStyle, background: "#050814" },
      children: [bgLayer, overlay, logo, content, handle].filter(Boolean),
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