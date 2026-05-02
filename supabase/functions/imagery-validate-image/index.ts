// Imagery Engine — Validator
// Recebe { slide_id } → puxa raw_image_url + brief, manda pra GPT-4o Vision avaliar 4 critérios.
// Retorna score 0-10 por critério + decisão keep/retry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é o Validador Visual do Imagery Engine da VS Soluções.
Recebe uma imagem gerada por IA e o brief original. Avalia 4 dimensões em escala 0-10:

1. brand_fit: aderência ao look editorial VS (paletas sóbrias, cinematográfico, sem cara de stock).
2. brief_match: o quanto a imagem entrega o que o brief pediu.
3. tech_quality: qualidade técnica (foco, ruído, mãos, rostos, artefatos).
4. usability: a imagem permite sobrepor texto/CTA com legibilidade?

Decisão final:
- "keep" se média ≥ 7 E nenhum critério < 5
- "retry" caso contrário (descreva o que ajustar em 1 frase no campo "ajuste_sugerido")

Devolva APENAS via tool call.`;

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
    const { data: slide } = await admin.from("imagery_slides").select("*").eq("id", slide_id).single();
    if (!slide?.raw_image_url) throw new Error("slide sem raw_image_url");

    await admin.from("imagery_slides").update({ status: "validating" }).eq("id", slide_id);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `BRIEF ORIGINAL:\n${slide.image_brief}\n\nTIPO: ${slide.image_type}\nAvalie a imagem.` },
              { type: "image_url", image_url: { url: slide.raw_image_url } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "validate_image",
            description: "Avaliação visual estruturada",
            parameters: {
              type: "object",
              properties: {
                brand_fit: { type: "number", minimum: 0, maximum: 10 },
                brief_match: { type: "number", minimum: 0, maximum: 10 },
                tech_quality: { type: "number", minimum: 0, maximum: 10 },
                usability: { type: "number", minimum: 0, maximum: 10 },
                decisao: { type: "string", enum: ["keep", "retry"] },
                ajuste_sugerido: { type: "string" },
                resumo: { type: "string", description: "1 frase curta sobre a imagem" },
              },
              required: ["brand_fit","brief_match","tech_quality","usability","decisao","resumo"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "validate_image" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Validator: ${resp.status} ${t.slice(0, 200)}`);
    }
    const j = await resp.json();
    const tc = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("Validator não retornou tool_call");
    const score = JSON.parse(tc.function.arguments);
    const media = (score.brand_fit + score.brief_match + score.tech_quality + score.usability) / 4;
    score.media = Math.round(media * 10) / 10;

    await admin.from("imagery_slides").update({
      validation_score: score,
      status: score.decisao === "keep" ? "ready" : "pending",
    }).eq("id", slide_id);

    await admin.from("imagery_logs").insert({
      slide_id, post_id: slide.post_id, step: "validate",
      provider: "lovable", model: "openai/gpt-5-mini",
      response_summary: score, custo_usd: 0.005,
      duracao_ms: Date.now() - t0, success: true,
    });

    return new Response(JSON.stringify(score), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imagery-validate-image error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});