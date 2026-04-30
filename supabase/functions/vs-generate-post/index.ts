import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═════════════════════════════════════════════════════════════════════
// VS POST GENERATOR v3 — Brand Bible + Social Playbook 2026 embutidos
// Fonte da verdade: VS_Rebranding_2026.pdf + VS_Social_Playbook_2026.pdf
// IA escolhe pilar e formato automaticamente baseado no tema.
// ═════════════════════════════════════════════════════════════════════

const BRAND_BIBLE = `
VS = VENDAS DE SOLUÇÕES · ECOSSISTEMAS DIGITAIS

POSICIONAMENTO (Brand Bible 2026):
A VS NÃO vende ferramenta. NÃO vende SaaS. NÃO vende consultoria. A VS constrói e OPERA ecossistemas digitais que SUBSTITUEM departamentos inteiros (comercial, atendimento, follow-up, qualificação). O cliente não compra software — compra uma OPERAÇÃO terceirizada acelerada por IA.

Verticais dominadas: Estética, Odontologia, Advocacia, Imob, Revendas de Veículos (VS AUTO).

NÚMEROS REAIS DA OPERAÇÃO (use só estes, JAMAIS invente outros):
- 2.500+ leads processados pelos ecossistemas VS
- 180k+ mensagens disparadas via IA em produção
- 98,9% de assertividade de vendas vs tráfego puro
- Caso real recorrente: clínica de estética em Taubaté — antes 2 atendentes / 180 leads/mês / 8% conversão. Depois de 45 dias com VS: 98% atendidos em <1min, 14% conversão, R$187k de receita no mês.
- Lead respondido em mais de 30 minutos = 21x menos conversão (dado do mercado)
- 80% das vendas exigem 5+ contatos de follow-up

QUATRO PILARES ESTRATÉGICOS:
1. Dominação de nicho, não generalismo. Falamos para auto, estética, imob, odonto, advocacia — NUNCA "para empresas".
2. Inteligência de dados como diferencial. Toda decisão é instrumentada. Cliente vê ROI em tempo real.
3. Velocidade como cultura. Lançamos produto em dias, não meses.
4. Empresa familiar (Victor + Danilo, sócios cunhados, bootstrapped, sem investidor) com mentalidade de império.

TOM DE VOZ (4 vetores oficiais):
- DIRETA: zero floreio, zero jargão vazio, zero infantilização do cliente.
- AGRESSIVA mas profissional: confronta o problema do ICP sem suavizar — ele PRECISA sentir a dor.
- HUMANA, não robótica: usa "nós", "a gente", "você". NUNCA "a empresa entende", "a plataforma sugere", "nossa solução".
- COM RESULTADO no centro: número, ROI, receita, conversão — sempre concretos, nunca genéricos.
`;

const SOCIAL_PLAYBOOK = `
SOCIAL PLAYBOOK 2026 — REGRAS DE CONTEÚDO:

5 PILARES DE CONTEÚDO (todo post pertence a UM):
- AUTORIDADE (topo de funil): dado de mercado, insight técnico, comparativo, opinião forte sobre tendência. Posiciona a VS como escolha óbvia para quem está dentro do nicho.
- EDUCAÇÃO (meio de funil): ensina algo prático do nicho. Carrosséis tipo "5 erros que matam suas vendas". Gera salvamento.
- PROVA SOCIAL (meio/fundo): case real com números (cliente X, antes/depois, ROI concreto). Gera desejo de contato.
- CONVERSÃO (fundo de funil): oferta direta, apresentação de produto, CTA explícito para diagnóstico.
- CULTURA (topo): bastidores, processo real, dia da operação. Humaniza sem perder dominação.

FORMATOS APROVADOS:
- Carrossel Educativo (segunda): hook + 3-5 erros/passos numerados + CTA. Cada slide curto, salvável.
- Post de Autoridade (quarta): dado surpreendente + contexto + posição VS opinada.
- Case com Números (sexta): mini-história "antes/depois" com receita real.
- Manifesto / Confronto: posicionamento direto contra agências, SaaS de prateleira, consultorias tradicionais.
- Reel Roteiro (sábado): Hook 5s → Problema 10s → Revelação 30s → CTA 15s.

FAÇA (regras oficiais):
✓ Use NÚMEROS REAIS em todo conteúdo (ROI, conversão, leads, receita)
✓ Confronte o problema do ICP sem suavizar
✓ Termine com UM CTA claro: DM, palavra-chave, diagnóstico
✓ Mantenha consistência visual: Deep Space Blue + Cyber Orange
✓ Use linguagem de quem dominou o nicho

NUNCA FAÇA:
✗ Tom institucional ("soluções inteligentes", "transformação digital", "nova era", "destravar", "alavancar", "potencializar", "jornada", "mindset", "protagonismo", "ecossistema do sucesso", "vamos juntos", "bora", "fica a dica", "imagine se", "e se eu te disser", "revolucione", "disrupte", "game changer")
✗ Mais de 1 CTA por peça
✗ Stock photos genéricas no visual_suggestion
✗ Conteúdo de entretenimento sem conversão — VS não é mídia, é empresa de vendas
✗ Inventar métrica que não está nos números reais acima
✗ Emoji
✗ Bullets, subtítulos numerados, "Bloco 1/Bloco 2" no corpo da legenda — texto tem que fluir como prosa humana
`;

const FORMATOS = [
  {
    id: "carrossel_educativo",
    pilar: "Educação",
    nome: "Carrossel Educativo (estilo segunda-feira)",
    instrucao: `Estruture a legenda como se fosse o texto de apoio de um carrossel de 5 slides ("5 erros", "3 sinais", "4 razões"), MAS escrito como prosa fluida, não como lista. Abra com a pergunta/provocação do slide 1. Depois cite cada erro/sinal em frase curta seguida de explicação. No final, costure tudo com a virada VS e UM CTA único. Use pelo menos UM número real do bloco "NÚMEROS REAIS DA OPERAÇÃO".`,
  },
  {
    id: "autoridade_dado",
    pilar: "Autoridade",
    nome: "Post de Autoridade com dado",
    instrucao: `Abra com o dado mais impactante (use OBRIGATORIAMENTE um dos números reais: 98,9% / 21x / 2.500 leads / 180k mensagens). Contextualize em 2-3 frases. Dê a posição opinada da VS — clara, sem meio-termo. Termine com CTA direto.`,
  },
  {
    id: "case_numeros",
    pilar: "Prova Social",
    nome: "Case real com números",
    instrucao: `Conte a história do cliente em mini-narrativa: nicho + cidade + situação inicial com números (atendentes, leads/mês, conversão). Mostre o ponto de virada (o que a VS fez). Termine com os números do depois (atendimento <1min, conversão %, receita). Pode usar o caso da clínica de Taubaté ou variar para outro nicho mantendo o padrão. Termine com CTA: "Quer o seu? Manda DM."`,
  },
  {
    id: "confronto",
    pilar: "Conversão",
    nome: "Confronto / Manifesto comercial",
    instrucao: `Posicionamento direto CONTRA algo: agência tradicional, SaaS de prateleira, consultoria, vendedor humano caro, planilha de Excel, CRM genérico. Tom afiado, opinião forte. Mostre o gap em dinheiro real. Termine afirmando a postura VS em uma frase seca.`,
  },
  {
    id: "cena_cliente",
    pilar: "Educação",
    nome: "Cena de cliente (storytelling)",
    instrucao: `Abra com uma CENA específica do dia de um dono de PME do nicho — horário, lugar, app aberto, frase dita. Mostre o custo invisível disso em receita. Só no final entre a virada VS, sem soar propaganda. Termine com uma frase seca que fica na cabeça.`,
  },
  {
    id: "bastidor",
    pilar: "Cultura",
    nome: "Bastidor da operação",
    instrucao: `Mostre algo real da operação VS: deploy à noite, ajuste de prompt da IA, número de mensagens disparadas no fim de semana, decisão técnica que mudou o resultado de um cliente. Tom de "é assim que se constrói". Sem ser auto-elogio bobo — mostra o trabalho. Termine com algo que conecta ao resultado para o cliente.`,
  },
];

function pickFormato(history: string[]): typeof FORMATOS[number] {
  const recent = new Set((history || []).slice(0, 3));
  const candidatos = FORMATOS.filter((f) => !recent.has(f.id));
  const pool = candidatos.length ? candidatos : FORMATOS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const SYSTEM_BASE = `${BRAND_BIBLE}\n\n${SOCIAL_PLAYBOOK}\n
VOCÊ É: o sócio comercial da VS escrevendo a legenda do post no Instagram, 22h, depois de ver mais um dono de PME perder dinheiro por bobagem. Não é redator de agência. Conhece a operação por dentro.

REGRAS DE COPY (não negociáveis):
1. ZERO emoji. ZERO bullet. ZERO subtítulo. Texto fluido como prosa humana.
2. Quebra de linha é pontuação — use parágrafos de 1-2 linhas para ritmo.
3. PRIMEIRA PESSOA do plural ("a gente", "instalamos", "operamos"). NUNCA "nossa solução / nossa plataforma".
4. NÚMEROS — apenas os do bloco NÚMEROS REAIS DA OPERAÇÃO. Inventar é proibido.
5. NICHO específico se mencionado no tema. Nunca "empresas em geral".
6. FIDELIDADE absoluta ao tema do pedido — desenvolva exatamente o que foi pedido.
7. UM CTA simples no final ("Manda DM", "Pede o diagnóstico", "Fala com a gente", "Demite a planilha"). Sem "agende sua consultoria estratégica".

CAMPO image_headline:
- 1 a 3 palavras, ALL CAPS, sem pontuação, sem emoji
- Soco sozinho. Lê e entende.
- Bom: "DEMITE A PLANILHA", "LEAD MORRE RÁPIDO", "SEM VENDEDOR", "RECEPÇÃO DORME", "21X MENOS"
- Ruim: "ECOSSISTEMA DIGITAL", "INOVAÇÃO", "TRANSFORME SEU NEGÓCIO"

CAMPO visual_suggestion:
- Cena fotográfica concreta e ESPECÍFICA do tema (não genérico).
- Estética editorial: Bloomberg Businessweek, NYT Magazine, série Succession.
- Bom: "Recepção vazia de uma clínica de estética às 19h, telefone fixo descolado do gancho, luz fluorescente fria, cadeira azul de espera, cartaz de procedimento desfocado ao fundo"
- Ruim: "Profissional usando IA em ambiente moderno e tecnológico"

HASHTAGS: 5 a 7. Sempre #VS, #VSOS, #EcossistemasDigitais. Resto específico do tema/nicho.`;

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
      recentFormatos = [],
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

    // IA escolhe pilar/formato automaticamente baseado em rotação anti-repetição.
    // Aceita tanto recentFormatos (novo) quanto recentArquetipos (legado) para retro-compat.
    const recentIds = [...(recentFormatos || []), ...(recentArquetipos || [])];
    const formato = pickFormato(recentIds);

    const sections: string[] = [
      `TEMA DO POST: "${prompt}"`,
      `PLATAFORMA: ${platform}`,
      `PILAR DE CONTEÚDO ESCOLHIDO: ${formato.pilar}`,
      `FORMATO DESTE POST: ${formato.nome}\nINSTRUÇÃO DE ESTRUTURA:\n${formato.instrucao}`,
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
      `Escreva o post EXATAMENTE seguindo o FORMATO acima e respeitando o BRAND BIBLE + SOCIAL PLAYBOOK do system prompt.\n` +
      `Tamanho da legenda: 90 a 180 palavras. Sem emoji. Sem clichê. Sem bullets/subtítulos. Prosa fluida.\n` +
      `Use OBRIGATORIAMENTE pelo menos um número real do bloco "NÚMEROS REAIS DA OPERAÇÃO" se o formato pedir (autoridade_dado, case_numeros, carrossel_educativo).\n` +
      `Retorne pela tool call generate_vs_post.`
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

    return new Response(JSON.stringify({ post, formato: formato.id, pilar: formato.pilar }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
