import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeBase64(base64: string): Uint8Array {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fetchAsInlineImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null; // skip PDFs, docs
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 4 * 1024 * 1024) return null; // cap at 4MB to be safe
    return { mimeType: ct.split(";")[0], data: bytesToBase64(buf) };
  } catch (e) {
    console.warn("fetchAsInlineImage failed:", url, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, style = "dark", platform = "Instagram", imageHeadline = "" } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carrega ativos visuais ativos da marca para enviar como referência multimodal
    const { data: assets } = await supabase
      .from("vs_brand_assets")
      .select("type, title, content, file_url")
      .eq("is_active", true);

    const visualAssets = (assets || []).filter(
      (a) => a.file_url && ["logo", "reference", "image", "palette", "typography"].includes(a.type),
    );
    const textRules = (assets || [])
      .filter((a) => a.content && ["rule", "tone", "manual", "palette", "typography"].includes(a.type))
      .map((a) => `[${a.type.toUpperCase()}] ${a.title}: ${a.content}`)
      .join("\n");

    const inlineRefs: { mimeType: string; data: string; label: string }[] = [];
    for (const a of visualAssets.slice(0, 6)) {
      const img = await fetchAsInlineImage(a.file_url as string);
      if (img) inlineRefs.push({ ...img, label: `${a.type}: ${a.title}` });
    }
    console.log(`[vs-generate-post-image] inline refs: ${inlineRefs.length}/${visualAssets.length}`);

    // Sanitiza headline para garantir 1-3 palavras ALL CAPS sem caracteres estranhos
    const cleanHeadline = (imageHeadline || "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    const hasHeadline = cleanHeadline.length > 0;

    // Rebranding 2026 (PRD): Brutalismo Tech.
    const promptSections = [
      `Generate a single 1:1 Instagram feed graphic for "VS" — a Brazilian B2B company that REPLACES entire sales & marketing departments with AI + automation. Aesthetic: BRUTALIST TECH (V4 Company / Linear / Vercel / Nubank product UI level — editorial, premium, minimal, high-impact).`,
      ``,
      inlineRefs.length > 0
        ? `BRAND REFERENCES: The ${inlineRefs.length} image(s) above are official VS brand assets. Replicate the exact logo shape and visual language. Do not invent a different identity.`
        : ``,
      ``,
      `═══ TEXT ON THE IMAGE — STRICTEST RULE ═══`,
      hasHeadline
        ? `The image MUST contain EXACTLY ONE text element with these EXACT characters and nothing else:\n\n"${cleanHeadline}"\n\nRules:\n- Spell it character-for-character. Do NOT alter, translate, abbreviate, or invent variations.\n- Do NOT add any other word, slogan, tagline, percentage, fake metric, version number, file name, hashtag, URL, watermark, or fake logo (no "BRUTAL.AI", no "REBRAND_V2", no "ONLINE", no "ECOSSISTEMAS DIGITAIS").\n- Do NOT add the VS logo unless an official reference logo was provided above — never draw a fake VS lockup.\n- Render in Poppins Black Italic style (ultra-bold, condensed, oblique). All caps. White (#FFFFFF) — optionally a SINGLE word in Cyber Orange (#FF5300) if there are 2-3 words. Massive scale, occupying 35-55% of canvas height.`
        : `The image MUST contain ZERO text. No words, no letters, no numbers, no fake logos, no watermarks. Pure visual composition only.`,
      `If you cannot render the text correctly in Portuguese with perfect spelling, render NO text at all instead of inventing.`,
      ``,
      `═══ MANDATORY PALETTE — USE ONLY THESE COLORS ═══`,
      `- Deep Space Blue #050814  → dominant background (≈75% of canvas)`,
      `- Pure White #FFFFFF        → main typography and high-contrast strokes`,
      `- Cyber Orange #FF5300      → ONE accent only (a single highlighted word, an underline, a small geometric shape, an arrow)`,
      `Forbidden: any other color, any pastel, any gradient using non-palette hues, any 3D rendering, any photographic stock imagery.`,
      ``,
      `═══ COMPOSITION (editorial, brutalist) ═══`,
      `- Massive negative space. ${hasHeadline ? "Headline anchored to one side or centered with bold off-balance composition." : "Pure abstract geometric composition."}`,
      `- Allowed motifs (subtle, monochromatic, palette-only): faint dotted grid background, single thin orange line/arrow, abstract bar-chart silhouette, terminal-style data block, geometric primitive (square/triangle), monospace tickers in tiny size.`,
      `- Forbidden motifs: cartoon people, smiling avatars, 3D blobs, sparkles, ribbons, handshake clichés, generic stock photography, decorative icons, gradients of other hues, fake software screenshots with invented UI text.`,
      `- Inspiration to MATCH in feel: V4 Company Instagram feed, Linear marketing site, Vercel hero pages, Nubank product shots.`,
      ``,
      `═══ THEME OF THIS POST (context only — DO NOT render this text on the image) ═══`,
      prompt,
      ``,
      `Platform: ${platform}. Format: square 1:1.`,
      textRules ? `\nADDITIONAL BRAND RULES FROM DATABASE:\n${textRules}` : ``,
    ];

    const requestParts: any[] = inlineRefs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
    requestParts.push({ text: promptSections.filter(Boolean).join("\n") });

    // Nano Banana 2 (Gemini 3.1 Flash Image Preview) — melhor renderização de texto e composição
    const MODEL = "gemini-3.1-flash-image-preview";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: requestParts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições do Gemini atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY inválida ou sem permissão." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini image error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const respParts = data?.candidates?.[0]?.content?.parts || [];
    const inlineImage = respParts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
    const base64 = inlineImage?.inlineData?.data || inlineImage?.inline_data?.data;
    const mimeType = inlineImage?.inlineData?.mimeType || inlineImage?.inline_data?.mime_type || "image/png";
    if (!base64) {
      console.error("No image in Gemini response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Nenhuma imagem retornada pela IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = decodeBase64(base64);
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-${style}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("vs-marketing")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return new Response(JSON.stringify({ image_url: dataUrl, style }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
    return new Response(JSON.stringify({ image_url: pub.publicUrl, style }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});