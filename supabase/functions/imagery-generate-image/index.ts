// Imagery Engine — Generator
// Recebe { slide_id } → lê brief, decide modelo, gera imagem, sobe pro storage, atualiza slide.
// Decision tree:
//   - usa somente Lovable AI Gateway para evitar falha por GOOGLE_API_KEY vazada/bloqueada
//   - founder/dashboard/vertical → Nano Banana Pro
//   - abstract/product → Nano Banana
//   - UI/textos no frame → gpt-image-1 (não usado nesta etapa, fica para compose)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const NEGATIVE_PROMPT = "stock photo, generic smiling people, pointing at camera, flat icons, clipart, cartoon, illustration, vector art, watermark, low quality, oversaturated, color photography, vibrant colors, pastel tones, soft lighting, harsh flash, motion blur, distorted hands, extra fingers, text artifacts, cluttered background, lens flare, instagram filter";

function buildPrompt(brief: string, imageType: string): string {
  const styleAnchor = "HIGH CONTRAST BLACK AND WHITE photography. Pure monochrome, no color. Deep blacks, bright whites, dramatic shadows. Editorial documentary style, gritty and raw. Magazine-grade composition. Heavy grain, film aesthetic. 1:1 aspect ratio. The image must look like a 35mm B&W photograph from a high-end editorial magazine.";
  let typeHint = "";
  switch (imageType) {
    case "founder":
      typeHint = "Anonymous portrait of a professional (face partially out of frame, back to camera, or shadowed silhouette). Gender and ethnicity ambiguous. Strong rembrandt-style lighting from one side. Brutal shadows.";
      break;
    case "dashboard":
      typeHint = "Close-up of a software interface on a dark screen. Monochrome UI, single accent color allowed. Real data feel.";
      break;
    case "vertical":
      typeHint = "Documentary B&W shot of the niche workspace. Real, lived-in. Strong directional light, deep shadows. Wide angle, environmental.";
      break;
    case "abstract":
      typeHint = "Abstract material study in pure B&W. Concrete texture, raw paper, brushed metal, or architectural shadows.";
      break;
    case "product":
      typeHint = "Product mockup in B&W studio shot. Single hard light source, dramatic shadows, dark backdrop.";
      break;
  }
  return `${brief}\n\n${typeHint}\n\nStyle: ${styleAnchor}\n\nAvoid: ${NEGATIVE_PROMPT}`;
}

async function uploadFromBase64(supa: any, postId: string, slideId: string, b64: string, suffix = "raw"): Promise<string> {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${postId}/${slideId}_${suffix}_${Date.now()}.png`;
  const { error } = await supa.storage.from("imagery").upload(path, bin, {
    contentType: "image/png", upsert: true,
  });
  if (error) throw error;
  const { data } = supa.storage.from("imagery").getPublicUrl(path);
  return data.publicUrl;
}

// --- Provider: Nano Banana via Gateway ---
async function genNanoBanana(prompt: string, model: string, cost: number): Promise<{ b64: string; model: string; cost: number }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`${model}: ${resp.status} ${txt.slice(0, 200)}`);
  }
  const j = await resp.json();
  const dataUrl = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) throw new Error(`${model}: sem imagem retornada`);
  const b64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
  return { b64, model, cost };
}

function pickProvider(imageType: string): "high" | "fast" {
  return ["founder", "dashboard", "vertical"].includes(imageType) ? "high" : "fast";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const { slide_id } = await req.json();
    if (!slide_id) {
      return new Response(JSON.stringify({ error: "slide_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: slide, error } = await admin.from("imagery_slides").select("*").eq("id", slide_id).single();
    if (error || !slide) throw new Error("Slide não encontrado");

    if (!slide.needs_image || !slide.image_brief) {
      await admin.from("imagery_slides").update({ status: "ready" }).eq("id", slide_id);
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("imagery_slides").update({ status: "generating" }).eq("id", slide_id);

    const prompt = buildPrompt(slide.image_brief, slide.image_type ?? "abstract");
    const tier = pickProvider(slide.image_type ?? "abstract");

    let result: { b64: string; model: string; cost: number } | null = null;
    if (tier === "high") {
      result = await genNanoBanana(prompt, "google/gemini-3-pro-image-preview", 0.04);
    } else {
      result = await genNanoBanana(prompt, "google/gemini-2.5-flash-image", 0.015);
    }

    const publicUrl = await uploadFromBase64(admin, slide.post_id, slide.id, result.b64, "raw");

    await admin.from("imagery_slides").update({
      raw_image_url: publicUrl, status: "ready",
    }).eq("id", slide_id);

    await admin.from("imagery_logs").insert({
      slide_id, post_id: slide.post_id, step: "generate_image",
      provider: "lovable_gateway", model: result.model, prompt_excerpt: prompt.slice(0, 500),
      response_summary: { url: publicUrl, tier },
      custo_usd: result.cost, duracao_ms: Date.now() - t0, success: true,
    });

    return new Response(JSON.stringify({ url: publicUrl, model: result.model, cost: result.cost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imagery-generate-image error:", e);
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { slide_id } = await req.clone().json().catch(() => ({}));
      if (slide_id) {
        await admin.from("imagery_slides").update({
          status: "failed", error_message: e?.message?.slice(0, 500) ?? "erro",
        }).eq("id", slide_id);
      }
    } catch {}
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});