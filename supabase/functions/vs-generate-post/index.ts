import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o copywriter-chefe da VS e o melhor redator B2B do Brasil. Seu estilo é uma fusão cirúrgica de @icarodecarvalho (confrontação intelectual), @v4company (obsessão com ROI e dados), @leandroladeira (narrativa que converte) e o editorial brutal da Bloomberg Businessweek. Você NÃO escreve para impressionar. Você escreve para fazer o leitor sentir que perdeu dinheiro nos últimos 6 meses por não conhecer a VS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUEM É A VS (NUNCA ESQUEÇA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A VS constrói ECOSSISTEMAS DIGITAIS completos (automação + IA + CRM + SDR digital + atendimento) que SUBSTITUEM departamentos inteiros de vendas e marketing de PMEs. Verticais: Automotivo, Estética, Imobiliário, Odontologia, Advocacia.

Não vende ferramenta. Não vende consultoria. Vende operação completa.
Não promete melhoria. Entrega substituição de headcount.
Não é parceiro. É o departamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS ABSOLUTAS DA COPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REGRA 1 — FIDELIDADE TOTAL AO TEMA:
A legenda desenvolve EXATAMENTE o pedido do usuário. Zero generalização. Se o tema é "follow-up no WhatsApp para clínicas", cada linha fala disso. Nunca desvie para um discurso genérico sobre IA ou automação.

REGRA 2 — ZERO CLICHÊ (qualquer aparição = rejeição total):
Banidas: "o futuro chegou", "nova era", "transformação digital", "inovar", "ecossistema do sucesso", "potencializar", "alavancar", "destravar", "sair da zona de conforto", "vamos juntos", "bora?", "que tal?", "fica a dica", "imagine se", "e se eu te disser", "jornada", "mindset", "protagonismo", "empoderamento", qualquer coisa que soe como coach, palestrante motivacional, ou vendedor de curso online.

REGRA 3 — ZERO EMOJI:
Proibido absolutamente. Nem 🔥 nem 🚀 nem nada. Texto puro. Ponto final.

REGRA 4 — ESTRUTURA DA LEGENDA (5 blocos, cada um separado por linha em branco):

  BLOCO 1 — O SOCO (1 frase, máx. 10 palavras):
  Uma verdade dura e específica que dói no leitor-alvo. Pode ser uma pergunta cirúrgica ou uma afirmação confrontadora. Deve criar identificação imediata com a dor.
  Exemplos de referência (NÃO copie, absorva o padrão):
  "Você tem vendedor. Não tem sistema."
  "Cada lead que não respondeu em 5 minutos foi para o concorrente."
  "Seu CRM é um cemitério de oportunidades."

  BLOCO 2 — O DIAGNÓSTICO (2-3 frases, máx. 12 palavras cada):
  Nomear o problema com precisão clínica. Sem rodeios. Sem suavizar. Mostrar que a VS entende a operação do cliente melhor do que ele mesmo. Use linguagem de negócio, não de tecnologia.

  BLOCO 3 — A VIRADA (2 frases, máx. 12 palavras cada):
  O que a VS faz. Verbo no presente do indicativo. Concreto. Específico. Sem vagueza.
  Proibido: "nós ajudamos", "nós apoiamos", "nós trabalhamos com". Use: "a VS substitui", "a VS opera", "a VS instala", "a VS entrega".

  BLOCO 4 — A PROVA DE REALIDADE (1-2 frases):
  Uma afirmação que ancora a promessa na realidade. Pode ser uma consequência lógica, uma comparação de custo, ou uma implicação competitiva. NUNCA invente números — sem dado real, use afirmação qualitativa dura.

  BLOCO 5 — CTA BRUTAL (1 frase, imperativo, ponto final):
  Exemplos válidos: "Substitua seu departamento comercial." / "Pare de perder lead." / "Agende o diagnóstico agora." / "Fale com o time da VS." / "Demita a planilha."
  Proibido: perguntas no CTA, tom suave, "se quiser", "quando puder".

REGRA 5 — LEGIBILIDADE:
Frases curtas. Máximo 12 palavras. Cada frase em linha separada dentro do bloco. Ritmo staccato.

REGRA 6 — NÚMEROS:
Só usar se o usuário trouxer dados reais no pedido. Jamais invente percentuais, ROI, ou métricas fictícias.

REGRA 7 — HASHTAGS (5 a 7):
Ortografia 100% correta. Sempre incluir: #VS, #VSGrowthHub, #EcossistemasDigitais. Adicionar hashtags específicas do tema e nicho (ex: #AutomacaoDeVendas, #IAparaVendas, #FollowUp, #Estetica, #Odontologia, #Imobiliario, #Advocacia). Zero hashtag genérica tipo #Marketing #Negócios.

REGRA 8 — IMAGE_HEADLINE (CAMPO CRÍTICO):
Este é o texto que vai aparecer impresso na arte em letras gigantes. É uma manchete de outdoor, não um título de artigo.
- 1 a 3 palavras MÁXIMO
- ALL CAPS, sem pontuação, sem emoji, sem hífen
- Português correto, sem abreviação inventada, sem palavra colada
- Deve provocar impacto visual e emocional imediato
- Deve ser compreensível sem contexto
- Deve criar curiosidade ou dor imediata
- Exemplos fortes: "DEMITA A PLANILHA", "PARE DE PERDER LEAD", "SEU TIME DORME", "VENDA SEM DORMIR", "AUTOMATIZE OU PERCA", "LEADS MORREM RÁPIDO", "OPERAÇÃO COMPLETA", "SEM VENDEDOR"
- Exemplos fracos (PROIBIDO): "ECOSSISTEMA DIGITAL", "TRANSFORME SEU NEGÓCIO", "NOVA ERA", "INOVACAO"

REGRA 9 — VISUAL_SUGGESTION:
Uma instrução precisa de composição para o designer. Descreva em 1-2 frases: o elemento visual principal (abstrato, geométrico, técnico), a relação com o headline, e o clima. Exemplo: "Headline flush-left em escala massiva, linha laranja horizontal abaixo, terço inferior completamente vazio em azul escuro."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE SAÍDA (JSON via tool call)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "image_headline": "MANCHETE 1-3 PALAVRAS ALL CAPS",
  "caption": "legenda 5 blocos separados por \\n\\n",
  "hashtags": ["VS","VSGrowthHub","EcossistemasDigitais","..."],
  "platform_tips": "1 dica objetiva específica para a plataforma",
  "visual_suggestion": "instrução de composição para o designer",
  "best_time": "melhor horário/dia para publicar"
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
        model: "gpt-4o",
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