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

    const colorScheme = style === "dark"
      ? "dark navy background (#0B1B36), VS Blue accents (#2E6FCC), Blue Light highlights (#4A8DE0), white typography"
      : "clean white/off-white background (#F7F9FC), VS Blue (#2E6FCC) and Blue Light (#4A8DE0) accents, dark navy details (#0B1B36)";

    const promptSections = [
      `You are generating a 1:1 (1024x1024) social media graphic for "VS Growth Hub" — Brazilian B2B consultancy for SMBs.`,
      ``,
      inlineRefs.length > 0
        ? `STRICT BRAND REFERENCES: The previous ${inlineRefs.length} image(s) are the OFFICIAL brand assets (logo, palette, typography samples, references). You MUST replicate their exact color palette, typographic feel, geometric language, logo shape, and overall composition style. Do NOT invent a different brand identity.`
        : `(No reference images provided — strictly follow the textual brand rules below.)`,
      ``,
      `MANDATORY PALETTE (use these HEX values literally, no other dominant colors):`,
      `- VS Blue: #2E6FCC`,
      `- Blue Light: #4A8DE0`,
      `- Dark Navy: #0B1B36`,
      `- Off-white: #F7F9FC`,
      `STYLE: ${style === "dark" ? "dark navy background with VS Blue/Blue Light accents and white type" : "off-white background with VS Blue / Blue Light accents and dark navy details"}.`,
      `TYPOGRAPHY (if any text appears): Barlow Condensed for headings, Barlow for body — bold, condensed, modern, NEVER serif, NEVER script, NEVER decorative.`,
      ``,
      `THEME OF THIS POST: ${prompt}`,
      `PLATFORM: ${platform}`,
      ``,
      `COMPOSITION RULES:`,
      `- Minimalist, editorial, premium B2B (Notion / Linear / Stripe level)`,
      `- Geometric shapes, subtle gradients of VS Blue → Blue Light, generous negative space`,
      `- Use abstract icons of growth/automation/data/AI when relevant — never literal foreign text`,
      `- Magazine-quality composition, high contrast, professional`,
      ``,
      `TEXT RULES ON THE IMAGE:`,
      `- DO NOT add captions, slogans or fake words. At most a single short headline in Portuguese (PT-BR), in Barlow Condensed Bold uppercase, fully legible, spelled correctly. If unsure, use NO text at all.`,
      `- NEVER write English text on screen.`,
      textRules ? `\nADDITIONAL BRAND RULES FROM DATABASE:\n${textRules}` : ``,
    ];

    const parts: any[] = inlineRefs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
    parts.push({ text: promptSections.filter(Boolean).join("\n") });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
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
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inlineImage = parts.find((p: any) => p?.inlineData?.data || p?.inline_data?.data);
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