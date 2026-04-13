/**
 * Sugere resposta com coaching em tempo real: fase da conversa, script ativo,
 * insights do lead e próxima mensagem. Usa tool-calling para output estruturado.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


const PERSONAS: Record<string, string> = {
  interesse: `PERSONA: Gancho Imediato. Direto, sem saudações vazias. Abra com dado relevante. Confiante mas não arrogante.`,
  objecao: `PERSONA: Reversão de Objeções. Diagnóstico: perguntas que revelam a dor real. Empático e consultivo.`,
  preco: `PERSONA: Reenquadramento de Valor. Foque em ROI, não em preço. Use números concretos.`,
  concorrente: `PERSONA: Diferenciação. Contraste sem criticar. Destaque o que é único na VS.`,
  ceticismo: `PERSONA: Prova sobre Promessa. Cases reais, números, depoimentos. Zero hipérboles.`,
  padrao: `PERSONA: Consultor VS. Conversacional, direto, focado em avançar o pipeline.`
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

function detectPhase(prospect: any, msgCount: number): { phase: string; phaseLabel: string; phaseDesc: string } {
  const status = prospect.status;
  const dia = prospect.dia_cadencia ?? 0;
  
  if (status === "novo" || msgCount === 0)
    return { phase: "abordagem", phaseLabel: "Abordagem Inicial", phaseDesc: "Primeiro contato — objetivo: despertar interesse e iniciar conversa" };
  if (status === "abordado" && msgCount <= 2)
    return { phase: "abertura", phaseLabel: "Abertura", phaseDesc: "Prospect foi abordado — objetivo: obter a primeira resposta" };
  if (status === "respondeu" || (status === "em_cadencia" && dia <= 1))
    return { phase: "diagnostico", phaseLabel: "Diagnóstico", phaseDesc: "Prospect engajou — objetivo: investigar dores e gaps do negócio" };
  if (status === "quente" || prospect.classificacao_ia === "quente")
    return { phase: "proposta", phaseLabel: "Apresentação de Valor", phaseDesc: "Lead quente — objetivo: propor call/diagnóstico e fechar" };
  if (status === "call_agendada")
    return { phase: "pre_call", phaseLabel: "Pré-Call", phaseDesc: "Call marcada — objetivo: confirmar e preparar o terreno" };
  if (status === "call_realizada" || status === "proposta_enviada")
    return { phase: "fechamento", phaseLabel: "Fechamento", phaseDesc: "Proposta feita — objetivo: tratar objeções finais e fechar" };
  if (status === "em_cadencia" && dia >= 7)
    return { phase: "reativacao", phaseLabel: "Reativação", phaseDesc: "Sem resposta há dias — objetivo: tentar ângulo diferente" };
  if (status === "frio")
    return { phase: "ultimo_contato", phaseLabel: "Último Contato", phaseDesc: "Lead frio — última tentativa antes de arquivar" };
  
  return { phase: "follow_up", phaseLabel: "Follow-up", phaseDesc: `Dia ${dia} da cadência — manter engajamento` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

    // AI client will use ANTHROPIC_API_KEY from env

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects").select("*").eq("id", prospect_id).single();
    if (pErr) throw pErr;

    // Parallel data fetching
    const [recentRes, sessionRes, olderRes, meddicRes, configRes] = await Promise.all([
      supabase.from("consultoria_conversas").select("direcao, conteudo, created_at")
        .eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(5),
      supabase.from("prospect_session_memory").select("fact_key, fact_value, confidence")
        .eq("prospect_id", prospect_id).order("confidence", { ascending: false }).limit(15),
      supabase.from("consultoria_conversas").select("direcao, conteudo, created_at")
        .eq("prospect_id", prospect_id).order("created_at", { ascending: true }).limit(20),
      supabase.from("prospect_meddic").select("pilar, score, evidencia_citacao")
        .eq("prospect_id", prospect_id),
      supabase.from("consultoria_config").select("system_prompt, script_a, script_b, script_c, followup_d1, followup_d3, followup_d7, followup_d14, followup_d30, nicho")
        .ilike("nicho", prospect.nicho).maybeSingle(),
    ]);

    const recentMsgs = recentRes.data;
    const sessionFacts = sessionRes.data;
    const olderMsgs = olderRes.data;
    const meddic = meddicRes.data;
    let config = configRes.data as Record<string, unknown> | null;

    if (!config) {
      const { data: allConfigs } = await supabase.from("consultoria_config")
        .select("system_prompt, script_a, script_b, script_c, followup_d1, followup_d3, followup_d7, followup_d14, followup_d30, nicho");
      if (allConfigs?.length) {
        const nichoLower = prospect.nicho.toLowerCase().trim();
        config = allConfigs.find((c: any) => {
          const cn = (c.nicho as string).toLowerCase().trim();
          return nichoLower.includes(cn) || cn.includes(nichoLower);
        }) ?? null;
      }
    }

    const lastProspectMsg = recentMsgs?.filter(m => m.direcao === "entrada")?.[0]?.conteudo ?? "";
    const intent = detectIntent(lastProspectMsg);
    const persona = PERSONAS[intent];
    const totalMsgCount = olderMsgs?.length ?? 0;
    const phaseInfo = detectPhase(prospect, totalMsgCount);

    const workingMemory = recentMsgs?.length
      ? [...recentMsgs].reverse().map(m => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`).join("\n")
      : "Nenhuma conversa anterior.";

    const sessionBlock = sessionFacts?.length
      ? "\nFATOS CONHECIDOS:\n" + sessionFacts.map(f => `• ${f.fact_key}: ${f.fact_value}`).join("\n") : "";
    const meddicBlock = meddic?.length
      ? "\nMEDDIC:\n" + meddic.map(m => `• ${m.pilar}: ${m.score}/10 — ${m.evidencia_citacao || "sem evidência"}`).join("\n") : "";
    const longTermBlock = totalMsgCount > 5
      ? `\nHISTÓRICO: ${totalMsgCount} mensagens trocadas.` : "";

    // Script reference
    let scriptRef = "";
    let activeScript = "";
    if (config) {
      const dia = prospect.dia_cadencia ?? 0;
      if (dia === 0 && prospect.status === "novo") {
        scriptRef = `Scripts:\nA: ${config.script_a}\nB: ${config.script_b}\nC: ${config.script_c}`;
        activeScript = "Scripts A/B/C — Abordagem inicial";
      } else if (dia <= 1) { scriptRef = `Follow-up D1: ${config.followup_d1}`; activeScript = "Follow-up D1"; }
      else if (dia <= 3) { scriptRef = `Follow-up D3: ${config.followup_d3}`; activeScript = "Follow-up D3"; }
      else if (dia <= 7) { scriptRef = `Follow-up D7: ${config.followup_d7}`; activeScript = "Follow-up D7"; }
      else if (dia <= 14) { scriptRef = `Follow-up D14: ${config.followup_d14}`; activeScript = "Follow-up D14"; }
      else { scriptRef = `Follow-up D30: ${config.followup_d30}`; activeScript = "Follow-up D30 — Último contato"; }
    }

    const isGenericNicho = !prospect.nicho || prospect.nicho === "Não definido" || prospect.nicho.toLowerCase() === "não definido";

    const baseSystemPrompt = config?.system_prompt
      ?? "Você é um especialista em vendas consultivas para o mercado brasileiro. Fale de forma natural, como um consultor real de negócios.";

    const nichoContext = isGenericNicho
      ? `NICHO: Ainda não identificado. O objetivo agora é DESCOBRIR o nicho/segmento do prospect através da conversa. Faça perguntas sobre o negócio dele de forma natural. NÃO mencione "nicho" ou "segmento" — pergunte sobre o que ele faz, como funciona o dia a dia, de onde vêm os clientes, etc.`
      : `NICHO: "${prospect.nicho}". Adapte completamente ao contexto deste nicho.`;

    const systemPrompt = `${baseSystemPrompt}

${nichoContext}

${persona}

INTENÇÃO DETECTADA: ${intent}
FASE: ${phaseInfo.phaseLabel} — ${phaseInfo.phaseDesc}

Analise a conversa e forneça coaching completo para o vendedor usando a ferramenta fornecida.

Regras RÍGIDAS para a mensagem sugerida:
- Português informal e natural, como se fosse um WhatsApp real entre profissionais
- NO MÁXIMO 1 emoji por mensagem (pode ter zero)
- NO MÁXIMO 2 parágrafos curtos
- NÃO use gírias excessivas, NÃO seja "animado demais", NÃO use múltiplas exclamações
- NÃO repita frases ou estruturas de mensagens anteriores
- Tom profissional e consultivo — você é um consultor de negócios, não um vendedor insistente
- Avance no pipeline: marcar call, gerar interesse, tratar objeção

${scriptRef ? `\nReferência (adapte, não copie):\n${scriptRef}` : ""}`;

    const userMessage = `Prospect: ${prospect.nome_negocio} (${prospect.nicho} — ${prospect.cidade})
Status: ${prospect.status} | Dia cadência: D${prospect.dia_cadencia ?? 0}
Decisor: ${prospect.decisor ?? "não identificado"}
Faturamento: ${prospect.faturamento_estimado ?? "não informado"}
Classificação: ${prospect.classificacao_ia ?? "não classificado"}
${meddicBlock}${sessionBlock}${longTermBlock}

Conversa recente:
${workingMemory}`;

    const { callClaude } = await import("../_shared/ai-client.ts");

    let coaching: any = {};
    try {
      const aiResult = await callClaude({
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [{
          name: "coaching_response",
          description: "Retorna coaching completo para o vendedor",
          input_schema: {
            type: "object",
            properties: {
              sugestao: { type: "string", description: "Mensagem sugerida para enviar ao prospect via WhatsApp" },
              insights: { type: "array", items: { type: "string" }, description: "2-4 insights curtos sobre o lead" },
              proximo_passo: { type: "string", description: "Próximo passo concreto" },
              alerta: { type: "string", description: "Alerta importante, se houver. Vazio se não houver." },
              tom_recomendado: { type: "string", description: "Tom recomendado para a próxima mensagem" },
            },
            required: ["sugestao", "insights", "proximo_passo", "tom_recomendado"],
          },
        }],
        tool_choice: { type: "tool", name: "coaching_response" },
        max_tokens: 1024,
      });

      if (aiResult.toolUse) {
        coaching = aiResult.toolUse.input;
      } else {
        coaching = { sugestao: aiResult.text ?? "", insights: [], proximo_passo: "", tom_recomendado: "" };
      }
    } catch (aiErr: any) {
      if (aiErr.message === "RATE_LIMIT") {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiErr.message?.includes("AUTH_ERROR")) {
        return new Response(JSON.stringify({ error: "Erro de autenticação na API de IA." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw aiErr;
    }

    return new Response(JSON.stringify({
      success: true,
      sugestao: coaching.sugestao,
      intent,
      persona: intent,
      phase: phaseInfo.phase,
      phase_label: phaseInfo.phaseLabel,
      phase_desc: phaseInfo.phaseDesc,
      active_script: activeScript,
      script_content: scriptRef,
      insights: coaching.insights || [],
      proximo_passo: coaching.proximo_passo || "",
      alerta: coaching.alerta || "",
      tom_recomendado: coaching.tom_recomendado || "",
    }), {
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
