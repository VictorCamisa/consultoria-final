// Imagery Engine — Compose (v2 · padrão V4/G4 brutalista aprovado)
// 5 templates: HOOK, SPLIT, DATA_SPLIT, LIST, CTA_HOOK
// Tipografia: Archivo Black (display brutalista) + Barlow Regular (corpo/markers)
// Logo VS aplicada em TODOS os slides.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import satori from "https://esm.sh/satori@0.10.13";
import { corsHeaders } from "../_shared/cors.ts";
import { VS_LOGO_DATA_URL } from "./logo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Carrega Archivo Black (display) + Barlow Regular (corpo) — fontes leves pra evitar CPU timeout
type FontEntry = { name: string; data: ArrayBuffer; weight: number; style: "normal" | "italic" };
let fontsCache: FontEntry[] | null = null;
async function loadFonts() {
  if (fontsCache) return fontsCache;
  async function fetchFont(url: string): Promise<ArrayBuffer> {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) throw new Error(`font fetch ${url} -> ${r.status}`);
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("html")) throw new Error(`font fetch returned HTML: ${url}`);
    return await r.arrayBuffer();
  }
  // Archivo Black: ~30KB single weight; Barlow Regular: ~80KB
  const [archivoBlack, barlowRegular] = await Promise.all([
    fetchFont("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/archivoblack/ArchivoBlack-Regular.ttf"),
    fetchFont("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/barlow/Barlow-Regular.ttf"),
  ]);
  fontsCache = [
    { name: "Display", data: archivoBlack, weight: 900, style: "normal" },
    { name: "Display", data: archivoBlack, weight: 900, style: "italic" }, // alias italic → mesmo arquivo
    { name: "Barlow", data: barlowRegular, weight: 400, style: "normal" },
    { name: "Barlow", data: barlowRegular, weight: 700, style: "normal" },
  ];
  return fontsCache;
}

// Paleta Tech Fusion 2026
const ORANGE = "#FF5300";
const BLACK = "#050814";   // Deep Space Blue
const NEAR_BLACK = "#0A0A0A";
const WHITE = "#FFFFFF";
const WHITE_60 = "rgba(255,255,255,0.6)";
const WHITE_40 = "rgba(255,255,255,0.4)";
const WHITE_30 = "rgba(255,255,255,0.3)";

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

// Sanitiza headline vindo da IA: remove "/" literais que a IA usa achando que quebra linha
function cleanHeadline(s: string): string {
  if (!s) return s;
  return s
    .replace(/\s*\/\s*/g, " ")  // "DESIGN / SEM / IMPACTO" → "DESIGN SEM IMPACTO"
    .replace(/\s*\|\s*/g, " ")  // pipes acidentais
    .replace(/\s+/g, " ")
    .trim();
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
    const headline = cleanHeadline((slide.copy_data?.headline as string) ?? "");
    // sub do T04 usa "||" e "|" como separadores — não sanitizar aqui
    const sub = ((slide.copy_data?.sub_text as string) ?? "").trim();

    // Paraleliza I/O pesado: imagem + fontes. O render SVG é rápido; conversão PNG fica no navegador.
    const [bgUrl, fonts] = await Promise.all([
      rawBg ? urlToDataUrl(rawBg) : Promise.resolve(undefined),
      loadFonts(),
    ]);

    const element = buildElement(slide.template_id, headline, sub, bgUrl);
    const svg = await satori(element, { width: 1080, height: 1080, fonts });

    const path = `${slide.post_id}/${slide.id}_final_${Date.now()}.svg`;
    const { error: upErr } = await admin.storage.from("imagery").upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml; charset=utf-8", upsert: true,
    });
    if (upErr) throw upErr;
    const { data: urlData } = admin.storage.from("imagery").getPublicUrl(path);
    const finalUrl = urlData.publicUrl;

    await admin.from("imagery_slides").update({
      final_png_url: finalUrl, status: "ready",
    }).eq("id", slide_id);

    await admin.from("imagery_logs").insert({
      slide_id, post_id: slide.post_id, step: "compose",
      provider: "satori", model: "svg-output",
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
      slide_id, step: "compose", provider: "satori", model: "svg-output",
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
    fontFamily: "Barlow",
    color: WHITE, position: "relative" as const,
  };

  // ─── Helpers visuais ───
  // Marker editorial estilo "// texto" (substitui font-mono que Satori não tem)
  const marker = (text: string, opts: { color?: string; size?: number; top?: number; left?: number; right?: number; bottom?: number } = {}) => {
    const pos: any = { position: "absolute" };
    if (opts.top !== undefined) pos.top = opts.top;
    if (opts.left !== undefined) pos.left = opts.left;
    if (opts.right !== undefined) pos.right = opts.right;
    if (opts.bottom !== undefined) pos.bottom = opts.bottom;
    return {
      type: "div", props: {
        style: {
          ...pos, fontFamily: "Barlow", fontWeight: 700,
          fontSize: opts.size ?? 18, color: opts.color ?? WHITE_60,
          letterSpacing: 4, textTransform: "uppercase", display: "flex",
        },
        children: text,
      },
    };
  };

  // Logo VS — canto inferior direito por padrão
  const brandLogo = (opts: { size?: number; bottom?: number; right?: number; top?: number; left?: number; opacity?: number; tint?: "white" | "black" } = {}) => {
    const pos: any = { position: "absolute" };
    pos.bottom = opts.bottom ?? 50;
    if (opts.right !== undefined) pos.right = opts.right;
    else if (opts.left !== undefined) pos.left = opts.left;
    else pos.right = 50;
    if (opts.top !== undefined) { pos.top = opts.top; delete pos.bottom; }
    return {
      type: "img", props: {
        src: VS_LOGO_DATA_URL,
        style: {
          ...pos,
          height: opts.size ?? 56, width: "auto",
          opacity: opts.opacity ?? 0.9,
          ...(opts.tint === "black" ? { filter: "brightness(0)" } : {}),
        },
      },
    };
  };

  // Display heading helper — Poppins Black Italic
  // CRÍTICO Satori: para text-wrap funcionar, o elemento precisa ter `width` fixo
  // (maxWidth NÃO quebra texto longo no Satori). Por isso usamos width obrigatório.
  const display = (text: string, opts: { size?: number; color?: string; lineHeight?: number; letterSpacing?: number; width?: number; align?: "left" | "center" | "right" } = {}) => ({
    type: "div", props: {
      style: {
        fontFamily: "Display", fontWeight: 900, fontStyle: "italic",
        fontSize: opts.size ?? 110,
        lineHeight: opts.lineHeight ?? 0.88,
        letterSpacing: opts.letterSpacing ?? -2,
        color: opts.color ?? WHITE,
        textTransform: "uppercase",
        ...(opts.width ? { width: opts.width } : {}),
        ...(opts.align ? { textAlign: opts.align } : {}),
        display: "flex",
        flexWrap: "wrap" as const,
        wordBreak: "break-word" as const,
        overflowWrap: "break-word" as const,
      },
      children: text,
    },
  });

  // Image with B&W treatment
  const bwImage = (src: string, style: any = {}) => ({
    type: "img", props: {
      src,
      style: {
        objectFit: "cover",
        filter: "grayscale(100%) contrast(125%)",
        ...style,
      },
    },
  });

  // ============================================================
  // T01_HOOK — Foto P&B fullbleed + headline gigante embaixo
  // ============================================================
  if (template === "T01_HOOK_BIG_TEXT") {
    const hasBg = !!bgUrl;
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          hasBg ? bwImage(bgUrl!, {
            position: "absolute", inset: 0, width: 1080, height: 1080,
            filter: "grayscale(100%) contrast(125%) brightness(75%)",
          }) : null,
          // Gradient overlay escurecendo embaixo (legibilidade)
          { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.25) 100%)", display: "flex" } } },
          // Barra superior laranja
          { type: "div", props: { style: { position: "absolute", top: 0, left: 0, width: 1080, height: 14, background: ORANGE, display: "flex" } } },
          // Markers topo
          marker("01", { top: 56, left: 64, color: WHITE_60 }),
          marker("VS · MANIFESTO", { top: 56, right: 64, color: ORANGE }),
          // Bloco headline embaixo
          { type: "div", props: {
            style: { position: "absolute", bottom: 110, left: 64, right: 64, display: "flex", flexDirection: "column", gap: 24 },
            children: [
              marker("// O QUE NINGUÉM TE CONTA", { color: ORANGE, size: 18 } as any),
              display(headlineUpper, { size: headlineUpper.length > 30 ? 110 : 150, lineHeight: 0.86, width: 952 }),
            ],
          } },
          marker("ARRASTE →", { bottom: 50, left: 64, color: WHITE_60 }),
          brandLogo({ bottom: 40, right: 50, size: 56 }),
        ].filter(Boolean),
      },
    };
  }

  // ============================================================
  // T02_SPLIT — Split 55/45 foto P&B esquerda + texto direita
  // ============================================================
  if (template === "T02_PROBLEM_STATEMENT") {
    const hasBg = !!bgUrl;
    return {
      type: "div", props: {
        style: { ...baseStyle, background: NEAR_BLACK, flexDirection: "row" },
        children: [
          // Lado esquerdo: foto P&B (55%)
          { type: "div", props: {
            style: { position: "absolute", top: 0, left: 0, width: 594, height: 1080, display: "flex" },
            children: [
              hasBg ? bwImage(bgUrl!, { position: "absolute", inset: 0, width: 594, height: 1080 }) : null,
              { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.3) 0%, transparent 50%, rgba(0,0,0,0.7) 100%)", display: "flex" } } },
              marker("CENA", { bottom: 50, left: 50, color: WHITE_60, size: 16 }),
            ].filter(Boolean),
          } },
          // Lado direito: texto (45%)
          { type: "div", props: {
            style: { position: "absolute", top: 0, right: 0, width: 486, height: 1080, padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between" },
            children: [
              marker("// DIAGNÓSTICO", { color: ORANGE, size: 18, top: 56, right: 56 } as any),
              { type: "div", props: {
                style: { display: "flex", flexDirection: "column", gap: 24, marginTop: 100 },
                children: [
                  display(headlineUpper, { size: headlineUpper.length > 18 ? 76 : 100, lineHeight: 0.85, width: 374 }),
                  sub ? { type: "div", props: {
                    style: { fontFamily: "Barlow", fontWeight: 400, fontSize: 24, color: WHITE_60, lineHeight: 1.3, width: 374, marginTop: 16, display: "flex", flexWrap: "wrap" as const },
                    children: sub,
                  } } : null,
                ].filter(Boolean),
              } },
              { type: "div", props: { style: { display: "flex", height: 1 } } },
            ],
          } },
          brandLogo({ bottom: 40, right: 50, size: 52 }),
        ].filter(Boolean),
      },
    };
  }

  // ============================================================
  // T03_DATA_SPLIT — Split 50/50: foto esquerda + número GIGANTE direita
  // ============================================================
  if (template === "T03_DATA_POINT") {
    const hasBg = !!bgUrl;
    // Headline esperado: "73%" ou "3X" etc
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK, flexDirection: "row" },
        children: [
          // Esquerda: foto P&B
          { type: "div", props: {
            style: { position: "absolute", top: 0, left: 0, width: 540, height: 1080, display: "flex" },
            children: [
              hasBg ? bwImage(bgUrl!, { position: "absolute", inset: 0, width: 540, height: 1080 }) : null,
              { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)", display: "flex" } } },
              marker("// TEMPO PERDIDO", { bottom: 50, left: 40, color: WHITE_60, size: 16 } as any),
            ].filter(Boolean),
          } },
          // Direita: número heroico
          { type: "div", props: {
            style: { position: "absolute", top: 0, right: 0, width: 540, height: 1080, padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between", background: BLACK },
            children: [
              { type: "div", props: {
                style: { display: "flex", justifyContent: "space-between", width: "100%" },
                children: [
                  marker("03", { color: WHITE_60, size: 18 }),
                  marker("DADO", { color: ORANGE, size: 18 }),
                ],
              } },
              { type: "div", props: {
                style: { display: "flex", flexDirection: "column", gap: 20 },
                children: [
                  display(headlineUpper, { size: headlineUpper.length <= 4 ? 280 : 200, color: ORANGE, lineHeight: 0.78, letterSpacing: -8 }),
                  { type: "div", props: { style: { width: 80, height: 4, background: ORANGE, display: "flex" } } },
                  sub ? display(sub.toUpperCase(), { size: 26, lineHeight: 1.1, width: 428 }) : null,
                ].filter(Boolean),
              } },
              { type: "div", props: { style: { display: "flex", height: 60 } } },
            ],
          } },
          brandLogo({ bottom: 40, right: 50, size: 50 }),
        ].filter(Boolean),
      },
    };
  }

  // ============================================================
  // T04_LIST — Lista numerada brutal (3 itens) + foto lateral sutil
  // headline = título da seção; sub = JSON serializado dos itens OU
  // formato pipe: "01|título 1|sub 1||02|título 2|sub 2||03|título 3|sub 3"
  // ============================================================
  if (template === "T05_PROCESS_STEP" || template === "T04_LIST") {
    const hasBg = !!bgUrl;
    let items: { n: string; t: string; s: string }[] = [];
    if (sub && sub.includes("||")) {
      items = sub.split("||").map(group => {
        const [n, t, s] = group.split("|").map(x => x?.trim() ?? "");
        return { n: n || "", t: t || "", s: s || "" };
      }).filter(it => it.t).slice(0, 3);
    }
    if (items.length === 0) {
      // Fallback: usa o headline como título único
      items = [
        { n: "01", t: "Atende em 30s", s: "IA conectada ao WhatsApp" },
        { n: "02", t: "Qualifica sozinha", s: "Score automático" },
        { n: "03", t: "Entrega o lead pronto", s: "Você só fecha" },
      ];
    }
    return {
      type: "div", props: {
        style: { ...baseStyle, background: NEAR_BLACK },
        children: [
          // Coluna lateral direita com foto sutil (30%)
          hasBg ? { type: "div", props: {
            style: { position: "absolute", top: 0, right: 0, width: 324, height: 1080, display: "flex", opacity: 0.4 },
            children: [
              bwImage(bgUrl!, { position: "absolute", inset: 0, width: 324, height: 1080, filter: "grayscale(100%) contrast(140%)" }),
              { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(270deg, transparent 0%, rgba(10,10,10,0.6) 60%, #0A0A0A 100%)", display: "flex" } } },
            ],
          } } : null,
          marker("04", { top: 56, left: 64, color: WHITE_60 }),
          marker("SOLUÇÃO · 3 PASSOS", { top: 56, right: 64, color: ORANGE }),
          // Título da seção
          { type: "div", props: {
            style: { position: "absolute", top: 140, left: 64, right: 64, display: "flex" },
            children: display(headlineUpper, { size: 64, lineHeight: 0.95, width: 952 }),
          } },
          // Lista
          { type: "div", props: {
            style: { position: "absolute", left: 64, right: 64, bottom: 130, display: "flex", flexDirection: "column", gap: 36 },
            children: items.map((it, idx) => ({
              type: "div", props: {
                key: idx,
                style: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 36, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)" },
                children: [
                  { type: "div", props: { style: { fontFamily: "Display", fontWeight: 900, fontStyle: "italic", fontSize: 92, color: ORANGE, lineHeight: 0.85, display: "flex", minWidth: 140 }, children: it.n } },
                  { type: "div", props: {
                    style: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
                    children: [
                      display(it.t.toUpperCase(), { size: 36, lineHeight: 1.05, width: 776 }),
                      it.s ? { type: "div", props: { style: { fontFamily: "Barlow", fontWeight: 400, fontSize: 22, color: WHITE_60, display: "flex", flexWrap: "wrap" as const, width: 776 }, children: it.s } } : null,
                    ].filter(Boolean),
                  } },
                ],
              },
            })),
          } },
          brandLogo({ bottom: 40, right: 50, size: 50 }),
        ].filter(Boolean),
      },
    };
  }

  // ============================================================
  // T05_CTA_HOOK — Foto fullbleed + headline + faixa CTA inferior laranja
  // ============================================================
  if (template === "T08_CTA_FINAL" || template === "T07_SOLUTION_REVEAL") {
    const hasBg = !!bgUrl;
    return {
      type: "div", props: {
        style: { ...baseStyle, background: BLACK },
        children: [
          hasBg ? bwImage(bgUrl!, {
            position: "absolute", inset: 0, width: 1080, height: 1080,
            filter: "grayscale(100%) contrast(125%) brightness(70%)",
          }) : null,
          { type: "div", props: { style: { position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.25) 100%)", display: "flex" } } },
          // Barra superior laranja
          { type: "div", props: { style: { position: "absolute", top: 0, left: 0, width: 1080, height: 14, background: ORANGE, display: "flex" } } },
          marker("05", { top: 56, left: 64, color: WHITE_60 }),
          marker("VS · DECIDA", { top: 56, right: 64, color: ORANGE }),
          // Headline
          { type: "div", props: {
            style: { position: "absolute", bottom: 200, left: 64, right: 64, display: "flex", flexDirection: "column", gap: 24 },
            children: [
              marker("// SUA PRÓXIMA DECISÃO", { color: ORANGE, size: 18 } as any),
              display(headlineUpper, { size: headlineUpper.length > 25 ? 110 : 150, lineHeight: 0.86, width: 952 }),
              sub ? { type: "div", props: { style: { fontFamily: "Barlow", fontWeight: 400, fontSize: 24, color: WHITE_60, marginTop: 8, width: 952, display: "flex", flexWrap: "wrap" as const }, children: sub } } : null,
            ].filter(Boolean),
          } },
          // Faixa CTA inferior laranja
          { type: "div", props: {
            style: { position: "absolute", bottom: 0, left: 0, width: 1080, height: 100, background: ORANGE, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 64px" },
            children: [
              { type: "div", props: { style: { fontFamily: "Display", fontWeight: 900, fontStyle: "italic", fontSize: 32, color: BLACK, textTransform: "uppercase", letterSpacing: -1, display: "flex" }, children: "→ VENDASDESOLUCOES.COM" } },
              { type: "img", props: { src: VS_LOGO_DATA_URL, style: { height: 56, width: "auto", filter: "brightness(0)" } } },
            ],
          } },
        ].filter(Boolean),
      },
    };
  }

  // ============================================================
  // FALLBACK — qualquer template_id não reconhecido vira HOOK
  // ============================================================
  return buildElement("T01_HOOK_BIG_TEXT", headline, sub, bgUrl);
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