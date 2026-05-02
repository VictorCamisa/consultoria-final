// Imagery Engine — Planner
// Recebe { tema, nicho, objetivo, tipo, n_slides } → cria post + slides com briefs visuais
// Modelo: google/gemini-2.5-pro via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `Você é o Planner do Imagery Engine da VS Soluções.

REFERÊNCIAS DE ESTÉTICA (CRÍTICO):
Inspirado em V4 Company e G4 Educação. Posts brutalistas, minimalistas, com tipografia
GIGANTE como protagonista absoluto, dados/números em destaque agressivo, zero firula visual.
Cada slide é um soco. Sem ornamentos, sem cores pastéis, sem gradientes suaves.
Apenas: tipografia massiva + foto P&B alto contraste + cor sólida (preto/branco/VS Blue).

REGRAS DA MARCA VS:
- Tom afiado, direto, provocativo. Manifesto, não vendedor.
- Headlines DEVEM ser frases de impacto: 3 a 7 palavras. Sem floreio.
- Use números, percentuais, comparações sempre que possível ("87%", "10x", "R$ 0").
- Zero emojis. Zero hashtags na copy dos slides.
- Sub_text é raro, opcional, no máximo 8 palavras. Use só se essencial.
- Voz de quem domina o problema. Nunca tom corporativo genérico.

TEMPLATES DISPONÍVEIS (escolha 1 por slide):
- T01_HOOK_BIG_TEXT: CAPA. Headline gigante ocupando o slide inteiro. Fundo preto sólido OU foto P&B.
- T02_PROBLEM_STATEMENT: Dor em uma frase brutal. Foto P&B de contexto com overlay escuro.
- T03_DATA_POINT: NÚMERO GIGANTESCO (ex: "87%", "3X", "R$0") + 1 linha curta de contexto.
- T04_BEFORE_AFTER: Comparação em duas colunas. Lado esquerdo = problema (vermelho/cinza). Lado direito = solução VS (azul).
- T05_PROCESS_STEP: Número da etapa GIGANTE (01, 02, 03) + título curto.
- T06_QUOTE_FOUNDER: Citação curta entre aspas, tipografia editorial. Sem foto.
- T07_SOLUTION_REVEAL: Solução em 1 frase. Fundo preto. Headline + linha azul VS de destaque.
- T08_CTA_FINAL: Chamada final brutal. Fundo VS Blue sólido. Headline branca.

DISTRIBUIÇÃO IDEAL DE TEMPLATES (siga essa proporção):
- Slide 1: SEMPRE T01_HOOK_BIG_TEXT
- Slide do meio: pelo menos 1 T03_DATA_POINT (dado quantitativo)
- Penúltimo: T07_SOLUTION_REVEAL
- Último: SEMPRE T08_CTA_FINAL

TIPOS DE IMAGEM (image_type) — USE COM PARCIMÔNIA:
- A maioria dos slides NÃO precisa de foto (needs_image = false). Tipografia é o foco.
- Use foto APENAS em T02 e ocasionalmente T01.
- T03, T05, T06, T07, T08: needs_image = false (só tipografia + cor sólida).
- T04: needs_image = false (split de cor).

TIPOS válidos quando needs_image = true:
- founder: retrato editorial anônimo, P&B.
- vertical: cena real do nicho (escritório, clínica, loja), P&B.
- dashboard: tela de software com dados reais.
- abstract: textura/material premium.

REGRAS PARA image_brief (quando aplicável):
- 40-80 palavras. Editorial cinematográfico. Sempre P&B alto contraste, mood denso.
- Sempre incluir: "high contrast black and white photography, deep shadows, gritty editorial mood".
- Para founder: mencionar "face partially out of frame, anonymous, ambiguous gender/ethnicity".
- BANIR: stock photo, sorrisos, ilustração, vetor, cartoon, gradientes coloridos, cores vibrantes na foto.

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