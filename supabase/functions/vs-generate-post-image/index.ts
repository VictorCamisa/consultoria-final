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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, style = "light", platform = "Instagram" } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const colorScheme = style === "dark"
      ? "dark navy background (#0B1B36), VS Blue accents (#2E6FCC), Blue Light highlights (#4A8DE0), white typography"
      : "clean white/off-white background (#F7F9FC), VS Blue (#2E6FCC) and Blue Light (#4A8DE0) accents, dark navy details (#0B1B36)";

    const imagePrompt = [
      `Create a professional 1:1 social media graphic (1024x1024) for "VS Growth Hub" — a Brazilian B2B consultancy that builds digital sales ecosystems for SMBs (medical/dental clinics, law firms, used car dealers).`,
      ``,
      `THEME: ${prompt}`,
      `PLATFORM: ${platform}`,
      `COLOR SCHEME: ${colorScheme}.`,
      `STYLE: minimalist, corporate, modern editorial — geometric shapes, subtle gradients, clean composition with generous negative space.`,
      ``,
      `CRITICAL TEXT RULES:`,
      `- ABSOLUTELY NO captions, slogans, body copy, fake words, or random letters/numbers on the image`,
      `- The image communicates only through visuals — geometry, color, light, abstract icons`,
      ``,
      `DESIGN RULES:`,
      `- Premium B2B / SaaS aesthetic (think Notion, Linear, Stripe marketing)`,
      `- Use abstract symbols of growth, automation, data, AI when relevant (charts, nodes, gears, flow lines) — never literal text`,
      `- Magazine-quality composition, high contrast, professional`,
      `- Brazilian audience, no English text on screen`,
    ].join("\n");

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
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