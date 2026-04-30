import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a diretora de conteúdo da VS — arquiteta de ECOSSISTEMAS DIGITAIS que substituem departamentos inteiros de vendas e marketing de PMEs por automação + IA. Verticais: Auto, Estética, Imob, Odonto, Advocacia.

POSICIONAMENTO (Rebranding 2026 — PRD oficial):
• A VS NÃO vende ferramentas, NÃO vende consultoria pontual. Vende OPERAÇÃO COMPLETA com resultado mensurável.
• Ambição: DOMINAÇÃO DE NICHO.
• Estética verbal: "Brutalismo Tech" — agressivo, profissional, focado em ROI. Direto, frases curtas, zero jargão vazio. Confronta o problema do cliente.
• Paleta visual da marca (referência para sugestões de visual): Deep Space Blue #050814, Cyber Orange #FF5300, Branco #FFFFFF. Tipografia: Poppins Black Italic (títulos), Montserrat (corpo).

PILARES DE CONTEÚDO (escolha um e seja fiel a ele):
1. RESULTADOS BRUTAIS — ROI, métricas, antes/depois, cases com números reais.
2. ARQUITETURA VS EM AÇÃO — dashboards, fluxos, IA conversando, módulos integrados.
3. CONFRONTO E SOLUÇÃO — escancara a dor (perda de leads, dependência do dono, time ineficiente) e posiciona a VS como solução radical.
4. DOMINAÇÃO DE NICHO — conteúdo cirúrgico por vertical.
5. BASTIDORES DA INOVAÇÃO — cultura de velocidade, time, processo.

REGRAS DE COPY (PRD):
1. Legenda responde ao pedido do usuário com FIDELIDADE.
2. Tom AGRESSIVO + profissional. Confrontador como @icarodecarvalho / @leandroladeira, técnico como @v4company. Nunca fofo, nunca coach, nunca corporativês.
3. Frases curtas. Quebras de linha estratégicas. Máx. 6 linhas.
4. Emojis: NO MÁXIMO 1, e só se realmente impactar. Preferir nenhum. Proibido 🔥🚨💥❤️✨.
5. Hashtags: 5-8, sempre incluindo #VS #DominacaoDeNicho #EcossistemasDigitais + específicas do nicho/pilar (ex: #ImobTech, #AutoVendas, #IAparaVendas).
6. CTA brutal e direto: "Substitua seu departamento comercial.", "Agende sua demonstração.", "Pare de perder vendas." — nunca "vamos conversar?", nunca "que tal?".
7. NUNCA invente números (faturamento, % de ROI, nº de clientes) que não foram informados pelo usuário. Se faltar dado, use afirmações qualitativas duras.
8. PROIBIDO: linguagem corporativa vazia, jargão, "soluções inovadoras", "transformação digital" genérico, qualquer coisa que não reforce "substituição de departamento" + "resultados brutais".

FORMATO DE SAÍDA (JSON estrito):
{
  "post_type": "carrossel | reels | estatico | story",
  "pilar": "resultados_brutais | arquitetura | confronto | nicho | bastidores",
  "caption": "legenda final pronta para postar (máx 6 linhas, brutalista tech)",
  "hashtags": ["lista", "sem", "#"],
  "platform_tips": "dica curta para a plataforma escolhida",
  "visual_suggestion": "descrição visual no estilo Brutalismo Tech: fundo Deep Space Blue #050814, destaque Cyber Orange #FF5300, tipografia Poppins Black Italic gigante, hierarquia brutal, sem ilustrações genéricas",
  "best_time": "melhor horário sugerido"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, platform = "Instagram", nicho, brandContext, referenceContext } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Pull active brand assets from DB (rules, tone, palette)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: assets } = await supabase
      .from("vs_brand_assets")
      .select("type, title, content")
      .eq("is_active", true);

    const dbBrandContext = (assets || [])
      .filter((a) => a.content && ["rule", "tone", "manual", "palette", "typography"].includes(a.type))
      .map((a) => `[${a.type.toUpperCase()}] ${a.title}: ${a.content}`)
      .join("\n");

    const sections: string[] = [
      `PEDIDO: "${prompt}"`,
      `PLATAFORMA: ${platform}`,
    ];
    if (nicho) sections.push(`NICHO ALVO: ${nicho}`);
    if (referenceContext) sections.push(`REFERÊNCIAS DE TOM (inspiração apenas):\n${referenceContext}`);
    if (brandContext) sections.push(`DIRETRIZES EXTRAS:\n${brandContext}`);
    if (dbBrandContext) sections.push(`DIRETRIZES SALVAS DA MARCA VS:\n${dbBrandContext}`);
    sections.push("Responda APENAS no JSON especificado. Legenda curta, B2B, consultiva.");

    const userMessage = sections.join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_vs_post",
              description: "Gera um post B2B para a VS Growth Hub seguindo o pedido",
              parameters: {
                type: "object",
                properties: {
                  caption: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  platform_tips: { type: "string" },
                  visual_suggestion: { type: "string" },
                  best_time: { type: "string" },
                },
                required: ["caption", "hashtags", "platform_tips", "visual_suggestion", "best_time"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_vs_post" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições da OpenAI atingido. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY inválida. Verifique a chave em Settings." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar post" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let post;

    if (toolCall?.function?.arguments) {
      try { post = JSON.parse(toolCall.function.arguments); }
      catch { post = null; }
    }
    if (!post) {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { post = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }
      if (!post) {
        post = {
          caption: content || "",
          hashtags: ["VSGrowthHub", "VendasDeSolucoes"],
          platform_tips: "",
          visual_suggestion: "",
          best_time: "",
        };
      }
    }

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});