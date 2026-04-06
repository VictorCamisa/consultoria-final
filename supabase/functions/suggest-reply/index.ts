/**
 * Sugere resposta com personas dinâmicas e memória em 3 camadas.
 * Usa Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Personas dinâmicas — selecionadas com base na intenção detectada
const PERSONAS: Record<string, string> = {
  interesse: `PERSONA: Gancho Imediato
Estilo: Direto, sem saudações corporativas vazias. Abra com um dado relevante ou provocação.
Tom: Confiante mas não arrogante. Foco em despertar curiosidade.
Regra: NUNCA comece com "Olá, tudo bem?" ou "Boa tarde!". Vá direto ao ponto.`,

  objecao: `PERSONA: Reversão de Objeções
Estilo: Diagnóstico. Quando o prospect resiste, mude para perguntas que revelam a dor real.
Tom: Empático e consultivo. Não pressione, investigue.
Regra: Reconheça a objeção, faça uma pergunta que revele o custo de NÃO resolver o problema.`,

  preco: `PERSONA: Reenquadramento de Valor
Estilo: Foque em ROI, não em preço. Use números concretos.
Tom: Seguro e didático.
Regra: Nunca justifique preço. Mostre o custo da inação vs. o retorno do investimento.`,

  concorrente: `PERSONA: Diferenciação
Estilo: Contraste sem criticar. Destaque o que é único na VS.
Tom: Respeitoso com o concorrente, confiante no diferencial.
Regra: NUNCA fale mal do concorrente. Foque no que a VS faz DIFERENTE.`,

  ceticismo: `PERSONA: Prova sobre Promessa
Estilo: Cases reais, números, depoimentos. Zero hipérboles.
Tom: Factual e transparente.
Regra: Substitua toda promessa por uma prova. "Aumentamos 40% as conversões da Clínica X em 3 meses" > "Somos os melhores".`,

  padrao: `PERSONA: Consultor VS
Estilo: Conversacional, direto, focado em avançar o pipeline.
Tom: Informal brasileiro, WhatsApp real.
Regra: Máximo 3 parágrafos curtos. Objetivo: marcar call ou gerar interesse.`
};

function detectIntent(lastMessage: string): string {
  const lower = lastMessage.toLowerCase();
  if (/caro|preço|valor|investimento|quanto custa|orçamento|budget/.test(lower)) return "preco";
  if (/já uso|concorr|outra empresa|alternativa|já tenho/.test(lower)) return "concorrente";
  if (/não sei|não acredito|prove|funciona mesmo|resultado|garantia/.test(lower)) return "ceticismo";
  if (/não preciso|não quero|não tenho interesse|agora não|sem tempo|ocupado/.test(lower)) return "objecao";
  if (/interesse|quero saber|me conte|como funciona|legal|bacana/.test(lower)) return "interesse";
  return "padrao";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    // CAMADA 1: Working Memory — últimas 5 mensagens
    const { data: recentMsgs } = await supabase
      .from("consultoria_conversas")
      .select("direcao, conteudo, created_at")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(5);

    // CAMADA 2: Session Memory — fatos extraídos
    const { data: sessionFacts } = await supabase
      .from("prospect_session_memory")
      .select("fact_key, fact_value, confidence")
      .eq("prospect_id", prospect_id)
      .order("confidence", { ascending: false })
      .limit(15);

    // CAMADA 3: Long-term Memory — histórico condensado (mais antigo)
    const { data: olderMsgs } = await supabase
      .from("consultoria_conversas")
      .select("direcao, conteudo, created_at")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Busca MEDDIC
    const { data: meddic } = await supabase
      .from("prospect_meddic")
      .select("pilar, score, evidencia_citacao")
      .eq("prospect_id", prospect_id);

    // Config por nicho
    let config: Record<string, unknown> | null = null;
    const { data: exactConfig } = await supabase
      .from("consultoria_config")
      .select("system_prompt, script_a, script_b, script_c, followup_d1, followup_d3, followup_d7, followup_d14, followup_d30, nicho")
      .ilike("nicho", prospect.nicho)
      .maybeSingle();

    if (exactConfig) {
      config = exactConfig;
    } else {
      const { data: allConfigs } = await supabase
        .from("consultoria_config")
        .select("system_prompt, script_a, script_b, script_c, followup_d1, followup_d3, followup_d7, followup_d14, followup_d30, nicho");
      if (allConfigs?.length) {
        const nichoLower = prospect.nicho.toLowerCase().trim();
        config = allConfigs.find((c: Record<string, unknown>) => {
          const cn = (c.nicho as string).toLowerCase().trim();
          return nichoLower.includes(cn) || cn.includes(nichoLower);
        }) ?? null;
      }
    }

    // Detecta intenção da última mensagem do prospect
    const lastProspectMsg = recentMsgs
      ?.filter(m => m.direcao === "entrada")
      ?.[0]?.conteudo ?? "";
    const intent = detectIntent(lastProspectMsg);
    const persona = PERSONAS[intent];

    // Monta Working Memory (últimas 5, cronológico)
    const workingMemory = recentMsgs?.length
      ? [...recentMsgs].reverse().map(m => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`).join("\n")
      : "Nenhuma conversa anterior.";

    // Monta Session Memory
    const sessionBlock = sessionFacts?.length
      ? "\n\nFATOS CONHECIDOS (extraídos de conversas anteriores):\n" + sessionFacts.map(f => `• ${f.fact_key}: ${f.fact_value}`).join("\n")
      : "";

    // Monta Long-term Memory (resumo)
    const totalMsgs = olderMsgs?.length ?? 0;
    const longTermBlock = totalMsgs > 5
      ? `\n\nHISTÓRICO LONGO: ${totalMsgs} mensagens trocadas no total. Primeiras interações: ${olderMsgs!.slice(0, 3).map(m => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`).join(" | ")}`
      : "";

    // Monta MEDDIC
    const meddicBlock = meddic?.length
      ? "\n\nQUALIFICAÇÃO MEDDIC:\n" + meddic.map(m => `• ${m.pilar}: ${m.score}/100 — ${m.evidencia_citacao || "sem evidência"}`).join("\n")
      : "";

    // Script sugerido por dia de cadência
    let scriptRef = "";
    if (config) {
      const dia = prospect.dia_cadencia ?? 0;
      if (dia === 0 && prospect.status === "novo")
        scriptRef = `Scripts de referência:\nA: ${config.script_a}\nB: ${config.script_b}\nC: ${config.script_c}`;
      else if (dia <= 1) scriptRef = `Follow-up D1 (referência): ${config.followup_d1}`;
      else if (dia <= 3) scriptRef = `Follow-up D3 (referência): ${config.followup_d3}`;
      else if (dia <= 7) scriptRef = `Follow-up D7 (referência): ${config.followup_d7}`;
      else if (dia <= 14) scriptRef = `Follow-up D14 (referência): ${config.followup_d14}`;
      else scriptRef = `Follow-up D30 (referência): ${config.followup_d30}`;
    }

    const systemPrompt = `${config?.system_prompt ?? "Você é um especialista em vendas consultivas para o mercado brasileiro."}

IMPORTANTE: Este prospect é do nicho "${prospect.nicho}". Adapte completamente sua linguagem ao contexto deste nicho. NÃO misture referências de outros nichos.

${persona}

INTENÇÃO DETECTADA: ${intent}

Sua tarefa é sugerir a próxima mensagem de WhatsApp para enviar ao prospect.

Regras:
- Português informal e natural, como conversa real de WhatsApp
- Direto, sem enrolação, máximo 1-2 emojis
- Máximo 3 parágrafos curtos
- Objetivo: avançar no pipeline (marcar call, gerar interesse, reativar)
- Se o prospect respondeu, CONTINUE a conversa naturalmente
- Se fez pergunta, RESPONDA antes de avançar
- Se demonstrou interesse, proponha próximo passo concreto
- Se mostrou objeção, trate com empatia usando a persona ativa
- NÃO repita frases de mensagens anteriores (anti-eco)

${scriptRef ? `\nReferência de scripts (adapte, não copie):\n${scriptRef}` : ""}

Responda APENAS com o texto da mensagem sugerida, sem aspas, sem explicações.`;

    const userMessage = `Prospect: ${prospect.nome_negocio} (${prospect.nicho} — ${prospect.cidade})
Status: ${prospect.status} | Dia cadência: D${prospect.dia_cadencia ?? 0}
Decisor: ${prospect.decisor ?? "não identificado"}
Faturamento: ${prospect.faturamento_estimado ?? "não informado"}
Classificação IA: ${prospect.classificacao_ia ?? "não classificado"}
${meddicBlock}
${sessionBlock}
${longTermBlock}

Conversa recente (Working Memory):
${workingMemory}`;

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI Gateway error (${aiRes.status}): ${errText}`);
    }

    const aiData = await aiRes.json();
    const sugestao = aiData.choices[0].message.content.trim();

    return new Response(JSON.stringify({ success: true, sugestao, intent, persona: intent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[suggest] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
