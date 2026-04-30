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
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 1.5 * 1024 * 1024) return null;
    return { mimeType: ct.split(";")[0], data: bytesToBase64(buf) };
  } catch (e) {
    console.warn("fetchAsInlineImage failed:", url, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, platform = "Instagram", imageHeadline = "" } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: assets } = await supabase
      .from("vs_brand_assets")
      .select("type, title, content, file_url")
      .eq("is_active", true);

    const textRules = (assets || [])
      .filter((a) => a.content && ["rule", "tone", "manual", "palette", "typography"].includes(a.type))
      .map((a) => `[${a.type.toUpperCase()}] ${a.title}: ${a.content}`)
      .join("\n");

    const cleanHeadline = (imageHeadline || "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    const hasHeadline = cleanHeadline.length > 0;
    const headlineWords = cleanHeadline.split(/\s+/);
    const accentWord = headlineWords.length > 1 ? headlineWords[headlineWords.length - 1] : "";

    const headlineInstruction = hasHeadline
      ? `
HEADLINE — THE SINGLE TEXT ELEMENT ON THIS IMAGE:
The only text allowed is exactly: "${cleanHeadline}"

Typography execution:
- Font: ultra-heavy condensed sans-serif, weight 900 (Poppins Black / Impact / Haas Grotesk Black style)
- Style: italic, tracking tight to -0.04em — letters nearly touching for maximum aggression
- Scale: headline occupies 45–65% of the canvas WIDTH — this is a POSTER-SCALE headline
- Color: Pure White #FFFFFF for all words${accentWord ? `, EXCEPT the last word "${accentWord}" which must be rendered in Cyber Orange #FF5300` : ""}
- Placement: flush-left aligned, anchored to the left 8% margin, positioned in the upper 55% of the canvas
- Text baseline sits at roughly 35–50% from the top of the canvas
- Lines: if multi-word, each word on its own line stacked tightly (line-height 0.9–1.0)
- Zero text shadow, zero glow, zero outline, zero stroke — clean flat ink on dark ground

CRITICAL TEXT RENDERING RULE:
Spell "${cleanHeadline}" character-for-character with perfect Portuguese orthography.
NEVER alter, abbreviate, merge, or split words.
NEVER add any other word, number, percentage, tagline, URL, watermark, hashtag, or pseudo-metric.
If you cannot render this text with perfect spelling, render NO text instead.`
      : `
TEXT RULE: ZERO text, ZERO letters, ZERO numbers on this image. Pure abstract geometric composition.`;

    const finalPrompt = `
TASK: Create a single, ultra-professional Instagram feed post graphic that looks like it was art-directed by a senior creative director at a top-tier design agency (Pentagram, Collins, Manual Creative level). The brand is VS — a Brazilian B2B company that replaces entire sales and marketing departments with AI automation.

AESTHETIC CODENAME: BRUTALIST TECH EDITORIAL
Reference points for visual feel (do NOT copy, absorb the DNA):
- Linear.app hero sections: ultra-dark, high-contrast, heavy type, no clutter
- Vercel marketing: surgical minimalism, type as hero, orange/white on black
- V4 Company Instagram: confrontational copy, editorial layout, dark backgrounds
- Stripe brand moments: every pixel intentional, negative space as power
- Bloomberg Businessweek covers: stark typographic composition

═══════════════════════════════════════════
CANVAS SPECIFICATION
═══════════════════════════════════════════
Format: Portrait 4:5 Instagram Feed
Background: solid Deep Space Blue #050814 — uniform, no vignette, no gradients
Safe zone: 8% padding on all edges (no design elements in the outer 8% margin)

═══════════════════════════════════════════
MANDATORY PALETTE — HARD RULE
═══════════════════════════════════════════
ONLY these three values exist in this image:
  1. Deep Space Blue #050814  → background base (≥70% of all pixels)
  2. Pure White #FFFFFF        → headline and primary graphic elements
  3. Cyber Orange #FF5300      → ONE accent, used ONCE with restraint

FORBIDDEN: any other hue, any pastel, any blue variant, any warm yellow, any green.
FORBIDDEN: gradients, color transitions, blending modes that introduce new hues.
A single orange line, underline, or orange word is the maximum orange usage.

═══════════════════════════════════════════
ABSOLUTE PROHIBITION — VS IDENTITY
═══════════════════════════════════════════
NEVER render the letters "VS" together in any form — no monogram, no logo, no large display, no stencil, no cracked letterform, no italic VS, no VS with arrows. Brand identity comes from palette + type weight + composition alone.

═══════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════
${headlineInstruction}

═══════════════════════════════════════════
ACCENT ELEMENT — ORANGE (choose EXACTLY ONE)
═══════════════════════════════════════════
Select one and only one of these orange accent options:
  Option A: A single horizontal rule — 2px thick, spanning exactly 30–40% of canvas width, placed just below the last line of the headline, flush to left margin
  Option B: A filled solid orange rectangle behind the last word of the headline only (word highlight block)
  Option C: A right-pointing arrow (→) rendered as a simple geometric shape, 40–60px equivalent scale, placed to the right of or below the headline

Do NOT combine options. One orange element. Maximum.

═══════════════════════════════════════════
BACKGROUND TEXTURE (ultra-subtle, optional)
═══════════════════════════════════════════
If a background texture is included, it must be ONE of:
  Texture A: Micro dot grid — dots 1px, spacing 16–24px, color #FFFFFF at 6–10% opacity
  Texture B: Thin horizontal lines — 1px line, 4px gap, color #0D1528 (slightly lighter than bg), opacity 40%
  Texture C: Single thin vertical or horizontal rule in #1a1f3a at 20% opacity crossing the canvas

These textures must be INVISIBLE at a glance — only perceptible on close inspection.

═══════════════════════════════════════════
COMPOSITIONAL LAW (EDITORIAL GRID)
═══════════════════════════════════════════
The canvas is divided into a 12-column, 16-row editorial grid.
Layout template — EXACTLY this hierarchy:
  1. HEADLINE: spans columns 1–10, rows 4–10 (upper-center mass)
  2. ORANGE ACCENT: placed in rows 11–12, directly below headline
  3. NEGATIVE SPACE: rows 13–16 (lower third) — completely empty, #050814 only
  4. Optional secondary texture: rows 1–3 (very subtle, not distracting)

NEGATIVE SPACE IS THE DESIGN. The bottom 35% of the canvas should be EMPTY dark background. This breathing room is not a failure — it IS the design intention. Magazines do this. Agencies do this. It communicates confidence.

ASYMMETRY RULE: Do not center-align the headline. Flush-left or slight right-offset is correct. Centered layouts feel corporate and weak.

═══════════════════════════════════════════
FORBIDDEN MOTIFS — ABSOLUTE LIST
═══════════════════════════════════════════
- Human figures, faces, hands, silhouettes, avatars, icons of people
- Stock photography of any kind
- 3D objects, renders, blobs, spheres, abstract shapes with depth
- Sparkles, stars, rays, halos, glows, neon effects
- Gradient meshes or multi-stop gradients
- Bar charts that look hand-drawn or cartoonish
- Decorative borders, rounded corners on text elements
- Fake software screenshots with invented UI copy
- Emoji, symbols, or special characters not part of the headline
- Handwriting or script fonts
- Cracked, distressed, halftone-destroyed typography
- Drop shadows on text
- The letters "V" and "S" appearing adjacent to one another in any form

═══════════════════════════════════════════
CONTEXT (DO NOT RENDER THIS TEXT ON IMAGE)
═══════════════════════════════════════════
Post theme: ${prompt}
Platform: ${platform}

${textRules ? `ADDITIONAL BRAND RULES:\n${textRules}` : ""}

═══════════════════════════════════════════
FINAL QUALITY BAR
═══════════════════════════════════════════
Before finalizing, ask yourself: Would a creative director at a top São Paulo agency approve this?
- Is the typography crisp, massive, and confident?
- Is the negative space generous and intentional?
- Is the orange accent restrained and purposeful?
- Is the overall feel cold, technical, aggressive, premium?
- Does it look like a printed poster, not an AI image?

If any answer is no, revise. This must be portfolio-worthy.
`.trim();

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: finalPrompt,
        size: "1024x1536",
        quality: "high",
        n: 1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da OpenAI atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY inválida ou sem acesso ao modelo gpt-image-1 (requer organização verificada)." }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI image error:", response.status, t);
      return new Response(JSON.stringify({ error: `Erro ao gerar imagem: ${t.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const base64: string | undefined = data?.data?.[0]?.b64_json;
    if (!base64) {
      console.error("No image in OpenAI response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Nenhuma imagem retornada pela IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mimeType = "image/png";

    const bytes = decodeBase64(base64);
    const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-feed.png`;

    const { error: uploadError } = await supabase.storage
      .from("vs-marketing")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      return new Response(JSON.stringify({ image_url: dataUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
    return new Response(JSON.stringify({ image_url: pub.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
