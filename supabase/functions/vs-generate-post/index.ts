import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────────────
// VS POST GENERATOR — humano, com história, sem fórmula visível
// ─────────────────────────────────────────────────────────────────────

const ARQUETIPOS = [
  {
    id: "caso",
    nome: "Cena de cliente real",
    instrucao: `Abra com uma CENA específica e concreta — não um slogan. Um momento real do dia de um dono/gestor (a recepcionista que esqueceu de responder, o vendedor que sumiu na sexta, o lead que entrou domingo e foi atendido segunda às 10h). Conte como se você tivesse acabado de ver acontecer. Detalhes pequenos importam: horário, sala, app aberto, frase dita. Depois mostre a consequência em dinheiro ou oportunidade. Só no final entre a virada (o que a VS faz) — sem soar como propaganda. Termine com uma frase seca que fica na cabeça.`,
  },
  {
    id: "manifesto",
    nome: "Manifesto curto",
    instrucao: `Um pensamento opinativo, em primeira pessoa do plural. Postura clara. Diga o que VOCÊ acredita sobre o tema, não o que "o mercado" pensa. Tom de quem viu muita operação por dentro e está cansado de ver o mesmo erro. Frases curtas e longas misturadas, com ritmo. Sem subtítulos, sem listas. Termine com uma afirmação que parece manifesto.`,
  },
  {
    id: "comparacao",
    nome: "Antes e depois sem clichê",
    instrucao: `Estrutura de contraste, mas sem usar as palavras "antes" ou "depois". Mostre duas operações lado a lado em prosa: a que funciona em 2026 e a que ainda finge que funciona. Use exemplos concretos do nicho. Sem tabelas. Sem bullets. Termine costurando que isso não é tendência — é diferença de quem fatura ou não.`,
  },
  {
    id: "conversa",
    nome: "Conversa interrompida",
    instrucao: `Comece com uma fala literal entre aspas — algo que um cliente real disse para a VS (pode ser inventado mas plausível). Reaja a essa fala. Desmonte o pressuposto por trás dela. Mostre o que essa fala revela sobre como o dono enxerga vendas. Depois proponha o jeito que a VS vê. Texto fluido, com você "respondendo" ao cliente.`,
  },
  {
    id: "diagnostico",
    nome: "Diagnóstico cirúrgico",
    instrucao: `Comece nomeando uma dor pequena e muito específica do nicho que ninguém fala em voz alta. Vá fundo no porquê acontece (processo, cultura, ferramenta). Mostre o custo invisível disso (lead que some, cliente que pediu desconto, time que faz hora extra). Só então diga como a VS resolve — em uma frase, sem catálogo de features.`,
  },
];

const SYSTEM_BASE = `Você escreve copy para a VS — uma operação de vendas terceirizada (automação + IA + CRM + SDR digital + atendimento) para PMEs nos nichos: Estética, Odontologia, Advocacia e Revendas de Veículos (VS AUTO).

Você NÃO é um redator de agência. Você é o sócio comercial da VS escrevendo no Instagram às 22h depois de mais um dia vendo PME perder dinheiro por bobagem. Tom: gente que conhece a operação por dentro, não palestrante.

REGRAS DE TOM (NÃO NEGOCIÁVEIS):

1. ZERO clichê de LinkedIn. Banidos: "transformação digital", "nova era", "futuro chegou", "alavancar", "destravar", "ecossistema do sucesso", "potencializar", "jornada", "mindset", "protagonismo", "vamos juntos", "bora", "fica a dica", "imagine se", "e se eu te disser", "revolucione", "disrupte", "game changer". Se a frase poderia estar num post genérico do Sebrae, reescreva.

2. ZERO emoji. Texto puro.

3. SEM ESTRUTURA VISÍVEL. Não use bullets, não use subtítulos, não use "Bloco 1, Bloco 2". O texto tem que parecer que alguém sentou e escreveu de uma vez, não que seguiu template.

4. ESPECIFICIDADE concreta. Em vez de "atendimento ruim", escreva "lead que entrou às 19h e foi respondido na terça". Em vez de "muitos negócios perdem", "a clínica de Curitiba que perdeu R$ 8k em maio porque a recepcionista tirou férias". Detalhes pequenos = credibilidade.

5. RITMO. Frases curtas misturadas com frases mais longas. Parágrafos de 1 linha são bem-vindos. Quebra de linha é pontuação.

6. PRIMEIRA PESSOA. Fale como VS, não sobre VS. "A gente vê isso toda semana", "instalamos em 14 dias", "não vendemos ferramenta, operamos a área comercial inteira". Nunca "nossa solução", "nossa plataforma".

7. CTA NO FINAL — uma única frase imperativa, simples. Nada de "agende sua consultoria estratégica". Use coisas como "Manda mensagem", "Fala com a gente", "Pede o diagnóstico", "Demite a planilha". Pode até não ter CTA explícito se a frase final já provoca a ação.

8. NÚMEROS — só os que o usuário deu. Jamais invente "300%", "10x", "92% dos clientes".

9. NICHO — se o tema cita um nicho (clínica, escritório, revenda), o post inteiro fala daquele nicho. Não generalize para "empresas".

10. FIDELIDADE AO TEMA — desenvolva EXATAMENTE o pedido. Se é follow-up no WhatsApp para estética, não vire um post sobre IA em geral.

CAMPO image_headline:
- 1 a 3 palavras, ALL CAPS, sem pontuação, sem emoji
- É o texto que vai impresso GIGANTE na arte
- Tem que dar soco sozinho, sem precisar do post
- Ortografia perfeita em português
- Bom: "DEMITE A PLANILHA", "LEAD MORRE RÁPIDO", "SEM VENDEDOR", "RECEPÇÃO DORME"
- Ruim: "ECOSSISTEMA DIGITAL", "INOVAÇÃO", "TRANSFORME SEU NEGÓCIO"

CAMPO visual_suggestion:
- Descreva uma CENA fotográfica concreta e específica do tema
- Não use palavras como "moderno", "tecnológico", "inovador"
- Pense em fotografia editorial: Bloomberg Businessweek, NYT Magazine
- Bom: "Recepção vazia de uma clínica de estética às 19h, telefone fixo descolado do gancho na bancada, luz fluorescente fria, cadeira de espera azul, cartaz de procedimento ao fundo desfocado"
- Ruim: "Profissional usando IA em ambiente moderno e tecnológico"

HASHTAGS: 5 a 7. Sempre #VS, #VSOS, #EcossistemasDigitais. Resto específico do tema/nicho.`;

function pickArquetipo(history: string[]): typeof ARQUETIPOS[number] {
  const recent = new Set((history || []).slice(0, 3));
  const candidatos = ARQUETIPOS.filter((a) => !recent.has(a.id));
  const pool = candidatos.length ? candidatos : ARQUETIPOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      prompt,
      platform = "Instagram",
      nicho,
      brandContext,
      referenceContext,
      recentCaptions = [],
      recentArquetipos = [],
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const arquetipo = pickArquetipo(recentArquetipos);

    const sections: string[] = [
      `PEDIDO: "${prompt}"`,
      `PLATAFORMA: ${platform}`,
      `ARQUÉTIPO DESTE POST: ${arquetipo.nome}\n${arquetipo.instrucao}`,
    ];
    if (nicho) sections.push(`NICHO ALVO: ${nicho}`);
    if (Array.isArray(recentCaptions) && recentCaptions.length) {
      sections.push(
        `POSTS RECENTES (NÃO repita aberturas, frases, manchetes ou estrutura — varie de verdade):\n` +
        recentCaptions.slice(0, 5).map((c: string, i: number) => `[${i + 1}] ${String(c).slice(0, 240)}`).join("\n")
      );
    }
    if (referenceContext) sections.push(`REFERÊNCIAS DE TOM (inspiração apenas):\n${referenceContext}`);
    if (brandContext) sections.push(`DIRETRIZES EXTRAS:\n${brandContext}`);
    if (dbBrandContext) sections.push(`DIRETRIZES SALVAS DA MARCA VS:\n${dbBrandContext}`);
    sections.push(
      `Escreva o post seguindo o ARQUÉTIPO acima. Tamanho: 90 a 180 palavras. Sem emoji. Sem clichê. Sem estrutura visível. Tem que parecer texto humano, não template. Retorne pelo tool call.`
    );

    const userMessage = sections.join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_BASE },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_vs_post",
              description: "Gera um post B2B humano e específico para a VS, seguindo o arquétipo definido",
              parameters: {
                type: "object",
                properties: {
                  image_headline: { type: "string", description: "1 a 3 palavras ALL CAPS sem pontuação. Único texto que vai na arte." },
                  caption: { type: "string", description: "Legenda 90-180 palavras, prosa fluida, sem bullets, sem emoji, sem clichê. Pode usar quebras de linha como ritmo." },
                  hashtags: { type: "array", items: { type: "string" } },
                  platform_tips: { type: "string" },
                  visual_suggestion: { type: "string", description: "Cena fotográfica concreta e específica do tema. Como uma direção de arte editorial." },
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
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Lovable AI error:", response.status, t);
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
          hashtags: ["VS", "VSOS", "EcossistemasDigitais"],
          platform_tips: "",
          visual_suggestion: "",
          best_time: "",
        };
      }
    }

    return new Response(JSON.stringify({ post, arquetipo: arquetipo.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
