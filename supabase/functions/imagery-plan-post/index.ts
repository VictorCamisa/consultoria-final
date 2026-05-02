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
V4 Company + G4 Educação. Brutalismo editorial. Tipografia Poppins Black Italic GIGANTE
protagonista. Foto P&B alto contraste estilo Sebastião Salgado. Acentos Cyber Orange #FF5300.
Fundo preto Deep Space Blue. Sem firula, sem stock photo, sem cor.

REGRAS DA MARCA VS:
- Tom afiado, direto, provocativo. Manifesto, não vendedor.
- Headlines: 3 a 7 palavras EM CAIXA ALTA. Frases de soco.
- Use números, %, comparações ("73%", "3X", "R$ 0", "8 meses").
- Zero emojis. Zero hashtags nos slides (só na caption).
- Sub_text opcional, máx 12 palavras. Apoio do headline, nunca repete.
- Voz de quem domina o problema. Nunca corporativo.

REGRAS DE FORMATAÇÃO DE TEXTO (CRÍTICO):
- NUNCA use "/" pra separar palavras no headline (ex: "DESIGN / SEM / IMPACTO" é ERRADO).
- NUNCA use "|" no headline. Escreva frase fluida: "DESIGN SEM IMPACTO".
- A quebra de linha é feita automaticamente pelo template — não force.
- Caracteres "/" e "|" são RESERVADOS apenas pro sub_text do T04_LIST.

TEMPLATES DISPONÍVEIS (apenas estes 5 — escolha 1 por slide):

1. T01_HOOK_BIG_TEXT — CAPA. Foto P&B fullbleed + headline gigante embaixo + barra laranja topo.
   Use no slide 1 SEMPRE. needs_image = true.

2. T02_PROBLEM_STATEMENT — SPLIT 55/45. Foto P&B esquerda + texto direita (3 palavras quebradas).
   Use pra DOR/DIAGNÓSTICO. needs_image = true.

3. T03_DATA_POINT — SPLIT 50/50. Foto P&B esquerda + número GIGANTE laranja direita ("73%", "3X").
   Use pra DADO/ESTATÍSTICA. headline DEVE ser o número curto. sub = contexto curto. needs_image = true.

4. T04_LIST — Lista numerada brutal de 3 itens + foto sutil lateral.
   Use pra PROCESSO/SOLUÇÃO em passos. needs_image = true.
   IMPORTANTE: headline = título da seção; sub = itens no formato "01|título 1|sub curto 1||02|título 2|sub curto 2||03|título 3|sub curto 3"

5. T08_CTA_FINAL — CTA brutal. Foto P&B + headline final + faixa laranja inferior com URL.
   Use no ÚLTIMO slide SEMPRE. needs_image = true.

DISTRIBUIÇÃO OBRIGATÓRIA:
- Se QUANTIDADE DE SLIDES = 1: gere EXATAMENTE 1 slide, somente T01_HOOK_BIG_TEXT. Não crie CTA separado.
- Se QUANTIDADE DE SLIDES > 1: Slide 1 SEMPRE T01_HOOK_BIG_TEXT e último slide SEMPRE T08_CTA_FINAL.
- Slides do meio: misture T02_PROBLEM_STATEMENT, T03_DATA_POINT, T04_LIST conforme o conteúdo
- Pelo menos 1 T03_DATA_POINT no meio se houver dado quantitativo

IMAGENS (needs_image SEMPRE true — todos os 5 templates usam foto):
- founder: retrato editorial anônimo, rosto cropado/sombra, P&B.
- vertical: cena real do nicho (escritório, clínica, oficina, loja), P&B.
- dashboard: tela de software/celular com dados, P&B.
- abstract: objeto simbólico do tema (relógio, dinheiro, mãos), P&B.

REGRAS para image_brief:
- 40-80 palavras. Editorial cinematográfico tipo Salgado. SEMPRE incluir:
  "high contrast black and white photography, deep shadows, gritty editorial mood, 35mm film grain, NO COLOR, pure monochrome".
- BANIR: stock, sorrisos, ilustração, cartoon, cores vibrantes, gradientes coloridos.
- Para founder: incluir "face partially out of frame, anonymous, ambiguous gender/ethnicity".

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
    const requestedSlides = Math.max(1, Math.min(8, Number(n_slides) || 1));
    if (!tema || !nicho || !objetivo) {
      return new Response(JSON.stringify({ error: "Faltam campos: tema, nicho, objetivo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria post draft
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: post, error: postErr } = await admin.from("imagery_posts").insert({
      user_id: user.id, tipo, tema, nicho, objetivo, n_slides: requestedSlides, status: "planning",
    }).select().single();
    if (postErr) throw postErr;

    const userPrompt = `TEMA: ${tema}
NICHO: ${nicho}
OBJETIVO: ${objetivo}
TIPO: ${tipo}
QUANTIDADE DE SLIDES: ${requestedSlides}

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
                      template_id: { type: "string", enum: ["T01_HOOK_BIG_TEXT","T02_PROBLEM_STATEMENT","T03_DATA_POINT","T04_LIST","T08_CTA_FINAL"] },
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