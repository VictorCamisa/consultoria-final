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

// Build a rich editorial prompt from the post theme
function buildPrompt(theme: string): string {
  return [
    `Editorial photography background for a premium B2B business post about: ${theme}.`,
    "Visual style: high-end cinematic, like Bloomberg Businessweek, Harvard Business Review covers, or HBO Succession.",
    "Choose the most fitting compositional approach:",
    "— A focused executive or professional under dramatic studio or window lighting, shallow depth of field, serious expression",
    "— A modern corporate architectural space: glass, concrete, steel, moody shadows and beams of light",
    "— Abstract close-up of premium materials: leather briefcase, metal desk surface, glass skyscraper reflection, hands typing",
    "— A serious team meeting in a dark boardroom, dramatic overhead lighting",
    "— Environmental detail shot: a city skyline at dusk from an executive office window",
    "Color palette: Deep blacks, dark navy, charcoal grey, with subtle warm accent light or cold blue-grey tones.",
    "Lighting: Hard shadows, dramatic side lighting, rim light, cinematic color grade.",
    "ABSOLUTE BANS — any of these ruins the image:",
    "NO text, words, letters, numbers, watermarks or labels of any kind.",
    "NO logos or brand marks.",
    "NO illustrations, vector art, flat design, 2D graphics, infographics.",
    "NO bar charts, pie charts, graphs, arrows, icons, UI elements.",
    "NO robots, sci-fi elements, holograms, cartoons, anime.",
    "MUST look like a real photograph taken with a professional full-frame camera.",
  ].join(" ");
}

async function generateWithImagen3(
  theme: string,
  apiKey: string
): Promise<string | null> {
  const prompt = buildPrompt(theme);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        safetyFilterLevel: "block_some",
        personGeneration: "allow_adult",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Imagen3 error:", res.status, text.slice(0, 400));
    return null;
  }

  const json = await res.json();
  const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
  return b64 ?? null;
}

async function generateWithDallE3(
  theme: string,
  apiKey: string
): Promise<string | null> {
  const prompt = buildPrompt(theme);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      size: "1024x1792",
      quality: "hd",
      response_format: "b64_json",
      n: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("DALL-E 3 error:", res.status, text.slice(0, 400));
    return null;
  }

  const json = await res.json();
  return json?.data?.[0]?.b64_json ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, platform = "Instagram" } = await req.json();

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!GOOGLE_API_KEY && !OPENAI_API_KEY) {
      throw new Error("Nenhuma API key configurada (GOOGLE_API_KEY ou OPENAI_API_KEY)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Imagen 3 first (better photorealism), DALL-E 3 as fallback
    let base64: string | null = null;
    let source = "";

    if (GOOGLE_API_KEY) {
      console.log("Trying Imagen 3...");
      base64 = await generateWithImagen3(prompt, GOOGLE_API_KEY);
      if (base64) {
        source = "imagen3";
        console.log("Imagen 3 succeeded.");
      } else {
        console.warn("Imagen 3 failed — trying DALL-E 3 fallback.");
      }
    }

    if (!base64 && OPENAI_API_KEY) {
      console.log("Trying DALL-E 3...");
      base64 = await generateWithDallE3(prompt, OPENAI_API_KEY);
      if (base64) source = "dalle3";
    }

    if (!base64) {
      return new Response(
        JSON.stringify({ error: "Nenhum modelo conseguiu gerar a imagem." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = "image/png";
    const bytes = decodeBase64(base64);
    const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-${source}.png`;

    const { error: uploadError } = await supabase.storage
      .from("vs-marketing")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ image_url: `data:${mimeType};base64,${base64}`, source }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
    return new Response(
      JSON.stringify({ image_url: pub.publicUrl, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vs-generate-post-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
