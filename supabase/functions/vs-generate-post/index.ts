import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é copywriter sênior B2B da VS. Escreve no estilo @icarodecarvalho + @v4company + @leandroladeira: confrontador, técnico, soco a soco, ZERO clichê de coach. Estética verbal "Brutalismo Tech" do PRD 2026.

QUEM É A VS:
Constrói ECOSSISTEMAS DIGITAIS sob medida (automação + IA) que SUBSTITUEM departamentos inteiros de vendas/marketing de PMEs. Verticais: Auto, Estética, Imob, Odonto, Advocacia. Ambição: DOMINAÇÃO DE NICHO. Não vende ferramenta. Não vende consultoria. Vende operação inteira.

REGRAS ABSOLUTAS DA COPY (qualquer violação = output rejeitado):

1. FIDELIDADE AO TEMA: a legenda OBRIGATORIAMENTE desenvolve o pedido literal do usuário. Nada de generalizar. Se o pedido é "follow-up no WhatsApp para clínicas", a legenda fala disso e SÓ disso.

2. ZERO CLICHÊ. PROIBIDO usar (eliminação automática se aparecer):
   - "o futuro chegou", "futuro do X", "nova era"
   - "sair da zona de conforto", "transformar realidade", "transformação digital"
   - "soluções inovadoras", "potencialize", "alavancar", "destravar"
   - "vamos conversar?", "bora?", "que tal?", "fica a dica"
   - "imagine se", "e se eu te disser"
   - qualquer coisa que pareça motivacional / coach / vendedor de curso

3. ZERO EMOJI. Nenhum. Proibido 🚀🔥💪✨📈🎯⚙️. Texto puro, brutalista.

4. ESTRUTURA OBRIGATÓRIA (4 a 6 linhas, separadas por linha em branco):
   - Linha 1: SOCO. Afirmação dura, confrontadora, específica. Pode ser pergunta cirúrgica.
   - Linha 2-3: o problema/diagnóstico em frases curtas. Sem rodeios.
   - Linha 4-5: o que a VS faz. Concreto. Verbo no presente do indicativo.
   - Última linha: CTA brutal e direto. Imperativo. Ponto final.

5. CTA OBRIGATORIAMENTE no imperativo, exemplos válidos:
   "Substitua seu departamento comercial." / "Pare de perder lead." / "Agende o diagnóstico." / "Fale com o time da VS." / "Demita a planilha."

6. Frases curtas. Máximo 12 palavras por frase. Quebra de linha entre blocos.

7. NÚMEROS: só usar se vierem no pedido do usuário. NUNCA invente "70% de ROI", "300% mais vendas", etc. Sem dado → afirmação qualitativa dura.

8. HASHTAGS: 5-7, ortografia 100% correta em português, sem typos. Sempre incluir #VS, #VSGrowthHub, #EcossistemasDigitais. Adicionar específicas do tema/nicho (ex: #AutomacaoComercial, #IAparaVendas, #FollowUp, #Estetica, #Odontologia).

9. IMAGE_HEADLINE — campo crítico:
   - 1 a 3 palavras MÁXIMO, ALL CAPS, sem pontuação, sem emoji
   - Português correto, sem abreviação inventada, sem palavra colada (não "BRUTAL.AI", não "REBRAND_V2")
   - É o ÚNICO texto que vai aparecer na arte. Pense como manchete de outdoor.
   - Exemplos válidos: "DEMITA A PLANILHA", "PARE DE PERDER LEAD", "AUTOMATIZE OU MORRA", "SEU TIME DORME", "VENDA ENQUANTO DORME"

FORMATO DE SAÍDA (JSON estrito, retornar via tool call):
{
  "image_headline": "MANCHETE 1-3 PALAVRAS",
  "caption": "legenda final 4-6 linhas",
  "hashtags": ["VS","VSGrowthHub","EcossistemasDigitais","..."],
  "platform_tips": "1 linha objetiva",
  "visual_suggestion": "1 linha descrevendo composição visual brutalista",
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
              description: "Gera um post B2B brutalista para a VS seguindo o pedido com fidelidade absoluta",
              parameters: {
                type: "object",
                properties: {
                  image_headline: { type: "string", description: "1 a 3 palavras ALL CAPS sem pontuação. Único texto que vai na arte." },
                  caption: { type: "string", description: "Legenda 4-6 linhas, brutalista, sem clichê, sem emoji" },
                  hashtags: { type: "array", items: { type: "string" } },
                  platform_tips: { type: "string" },
                  visual_suggestion: { type: "string" },
                  best_time: { type: "string" },
                },
                required: ["image_headline", "caption", "hashtags", "platform_tips", "visual_suggestion", "best_time"],
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
          image_headline: "VS",
          caption: content || "",
          hashtags: ["VS", "VSGrowthHub", "EcossistemasDigitais"],
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