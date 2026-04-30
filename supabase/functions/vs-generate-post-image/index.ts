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
    const { prompt, style = "light", platform = "Instagram" } = await req.json();
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

    // Rebranding 2026 (PRD): Brutalismo Tech.
    // Paleta "Tech Fusion": Deep Space Blue #050814 (base), Cyber Orange #FF5300 (ação), Branco #FFFFFF.
    const promptSections = [
      `You are generating a 1:1 (1024x1024) Instagram graphic for "VS" — Brazilian company that builds DIGITAL ECOSYSTEMS replacing entire sales/marketing departments via AI + automation. Aesthetic: BRUTALIST TECH (inspired by V4 Company, Linear, Vercel, Nubank product UI).`,
      ``,
      inlineRefs.length > 0
        ? `BRAND REFERENCES: The previous ${inlineRefs.length} image(s) are official VS brand assets (logo, references). Replicate their exact logo shape and visual language. They override generic assumptions.`
        : `(No reference images — follow textual rules strictly.)`,
      ``,
      `MANDATORY "TECH FUSION" PALETTE — use ONLY these colors, no others:`,
      `- Deep Space Blue #050814 (dominant background, ~70% of canvas)`,
      `- Cyber Orange #FF5300 (action color — CTAs, key numbers, single highlighted word)`,
      `- Pure White #FFFFFF (main typography and contrast)`,
      `Absolutely NO other colors. NO blues, NO purples, NO gradients of other hues. Subtle dark-on-dark grid texture / digital noise on the background is allowed and encouraged.`,
      ``,
      `TYPOGRAPHY (if any text appears on the image):`,
      `- Headings: Poppins Black Italic, ULTRA BOLD, condensed, GIANT scale (occupy 40-70% of the canvas height for the hero word/number).`,
      `- Body: Montserrat regular/medium.`,
      `- NEVER serif, NEVER script, NEVER decorative, NEVER handwriting.`,
      `- All text in Portuguese (PT-BR), correctly spelled, ALL CAPS for the hero line.`,
      ``,
      `BRUTAL VISUAL HIERARCHY:`,
      `- One single hero element (a number, a verb, a confrontational word) takes massive disproportionate space.`,
      `- Everything else is small, secondary, almost annotation-like.`,
      `- High contrast, alta densidade de impacto, zero ornamento.`,
      `- Allowed motifs: software UI mockups, dashboards, AI chat bubbles, ROI charts, grid lines, terminal-like blocks, monospace data — all in the Tech Fusion palette.`,
      ``,
      `STRICTLY FORBIDDEN (PRD):`,
      `- Generic stock illustrations, 3D blobs, cartoon people, smiling avatars.`,
      `- Soft pastel palettes, pink, purple, teal, green.`,
      `- Decorative icons, sparkles, ribbons, "corporate handshake" imagery.`,
      `- Empty corporate buzzwords on screen.`,
      `- Anything that does NOT reinforce "we replace entire departments" + "brutal results".`,
      ``,
      `THEME / IDEA FOR THIS POST: ${prompt}`,
      `PLATFORM: ${platform} (Instagram feed, 1:1).`,
      `STYLE TOKEN: ${style}.`,
      textRules ? `\nADDITIONAL BRAND RULES FROM DATABASE:\n${textRules}` : ``,
    ];

    const requestParts: any[] = inlineRefs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
    requestParts.push({ text: promptSections.filter(Boolean).join("\n") });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;
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