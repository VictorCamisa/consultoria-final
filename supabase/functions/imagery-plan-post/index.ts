// Imagery Engine — Planner
// Recebe { tema, nicho, objetivo, tipo, n_slides } → cria post + slides com briefs visuais
// Modelo: google/gemini-2.5-pro via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é o Planner do Imagery Engine da VS Soluções.

Sua função: receber o pedido de um post de Instagram e devolver a estrutura completa do post,
slide a slide, com COPY curta e BRIEF VISUAL profissional para cada slide.

REGRAS DA MARCA VS:
- Tom direto, técnico, sem clichês de marketing.
- Frases curtas (máximo 8 palavras por slide na headline).
- Zero emojis. Zero hashtags genéricas.
- Voz de quem entende do problema do cliente, não de quem vende.

TEMPLATES DISPONÍVEIS (escolha 1 por slide):
- T01_HOOK_BIG_TEXT: capa com texto enorme (40-60% da área), fundo escuro/abstrato.
- T02_PROBLEM_STATEMENT: 1 frase grande explicando a dor + imagem de contexto.
- T03_DATA_POINT: número/estatística gigante + 1 linha de contexto.
- T04_BEFORE_AFTER: split com "antes" vs "depois".
- T05_PROCESS_STEP: 1 etapa de um processo com ícone/visual.
- T06_QUOTE_FOUNDER: citação curta + foto/silhueta.
- T07_SOLUTION_REVEAL: a solução em 1 frase + visual de produto/dashboard.
- T08_CTA_FINAL: chamada final, fundo VS Blue (#2E6FCC), texto branco.

TIPOS DE IMAGEM (image_type):
- founder: pessoa/silhueta humana, retrato editorial.
- dashboard: tela de software, gráfico, métrica visual.
- vertical: foto de nicho específico (clínica, escritório, loja).
- abstract: textura, gradiente, elemento gráfico.
- product: mockup de produto/tela/dispositivo.

REGRAS PARA image_brief (CRÍTICO):
- Mínimo 40 palavras, máximo 80.
- Sempre incluir: ângulo, iluminação, paleta, mood, elementos no frame.
- Estilo: editorial, cinematográfico, fotografia profissional. NUNCA "ilustração", "vetor", "cartoon".
- Para founder: sempre mencionar "raça/gênero não definido", "rosto parcialmente fora do frame ou de costas" para evitar deepfakes.
- Banir: stock photo look, sorrisos forçados, gente apontando, gráficos genéricos, ícones flat.

Devolva APENAS JSON via tool call.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tema, nicho, objetivo, tipo = "carrossel", n_slides = 5 } = body;
    if (!tema || !nicho || !objetivo) {
      return new Response(JSON.stringify({ error: "Faltam campos: tema, nicho, objetivo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria post draft
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: post, error: postErr } = await admin.from("imagery_posts").insert({
      user_id: user.id, tipo, tema, nicho, objetivo, n_slides, status: "planning",
    }).select().single();
    if (postErr) throw postErr;

    const userPrompt = `TEMA: ${tema}
NICHO: ${nicho}
OBJETIVO: ${objetivo}
TIPO: ${tipo}
QUANTIDADE DE SLIDES: ${n_slides}

Gere a estrutura completa.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "plan_post",
            description: "Estrutura completa de um post Instagram da VS",
            parameters: {
              type: "object",
              properties: {
                titulo_post: { type: "string" },
                caption_final: { type: "string", description: "Caption longa para legenda do post (até 600 chars)" },
                hashtags: { type: "array", items: { type: "string" }, maxItems: 8 },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      slide_n: { type: "number" },
                      template_id: { type: "string", enum: ["T01_HOOK_BIG_TEXT","T02_PROBLEM_STATEMENT","T03_DATA_POINT","T04_BEFORE_AFTER","T05_PROCESS_STEP","T06_QUOTE_FOUNDER","T07_SOLUTION_REVEAL","T08_CTA_FINAL"] },
                      headline: { type: "string", description: "Texto principal, max 8 palavras" },
                      sub_text: { type: "string", description: "Apoio opcional, max 15 palavras" },
                      needs_image: { type: "boolean" },
                      image_type: { type: "string", enum: ["founder","dashboard","vertical","abstract","product"] },
                      image_brief: { type: "string", description: "Brief visual 40-80 palavras" },
                    },
                    required: ["slide_n","template_id","headline","needs_image"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["titulo_post","caption_final","slides"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "plan_post" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      await admin.from("imagery_posts").update({ status: "failed", error_message: `Planner: ${aiResp.status} ${txt.slice(0, 200)}` }).eq("id", post.id);
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      return new Response(JSON.stringify({ error: "AI gateway error", details: txt.slice(0, 300) }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI não retornou tool_call");
    const plan = JSON.parse(toolCall.function.arguments);

    // Salva slides
    const slidesRows = plan.slides.map((s: any) => ({
      post_id: post.id,
      slide_n: s.slide_n,
      template_id: s.template_id,
      needs_image: s.needs_image,
      image_type: s.image_type ?? null,
      image_brief: s.image_brief ?? null,
      copy_data: { headline: s.headline, sub_text: s.sub_text ?? null },
      status: "pending",
    }));
    const { error: slidesErr } = await admin.from("imagery_slides").insert(slidesRows);
    if (slidesErr) throw slidesErr;

    await admin.from("imagery_posts").update({
      copy_data: { titulo: plan.titulo_post, caption: plan.caption_final, hashtags: plan.hashtags ?? [] },
      status: "draft",
    }).eq("id", post.id);

    await admin.from("imagery_logs").insert({
      post_id: post.id, step: "plan", provider: "lovable", model: "google/gemini-2.5-pro",
      prompt_excerpt: userPrompt.slice(0, 500), response_summary: { n_slides: plan.slides.length },
      duracao_ms: Date.now() - t0, success: true,
    });

    return new Response(JSON.stringify({ post_id: post.id, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("imagery-plan-post error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});