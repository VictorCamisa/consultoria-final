/**
 * Classifica prospect usando MEDDIC estruturado via tool calling.
 * Usa OpenAI API. Salva pilares MEDDIC + classificação.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";


const MEDDIC_TOOL = {
  type: "function" as const,
  function: {
    name: "classify_prospect_meddic",
    description: "Classifica prospect com MEDDIC estruturado e classificação geral",
    parameters: {
      type: "object",
      properties: {
        classificacao: { type: "string", enum: ["quente", "morno", "frio"] },
        score: { type: "number", description: "Score geral 0-100" },
        resumo: { type: "string", description: "1-2 frases sobre estágio da conversa" },
        motivo: { type: "string", description: "Motivo curto da classificação" },
        meddic: {
          type: "object",
          properties: {
            metrics: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] },
            economic_buyer: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] },
            decision_criteria: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] },
            decision_process: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] },
            identify_pain: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] },
            champion: { type: "object", properties: { score: { type: "number" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "evidence", "confidence"] }
          },
          required: ["metrics", "economic_buyer", "decision_criteria", "decision_process", "identify_pain", "champion"]
        }
      },
      required: ["classificacao", "score", "resumo", "motivo", "meddic"],
      additionalProperties: false
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects").select("*").eq("id", prospect_id).single();
    if (pErr) throw pErr;

    const { data: conversas } = await supabase
      .from("consultoria_conversas").select("direcao, conteudo, created_at")
      .eq("prospect_id", prospect_id).order("created_at", { ascending: true }).limit(30);

    const { data: memories } = await supabase
      .from("prospect_session_memory").select("fact_key, fact_value, confidence")
      .eq("prospect_id", prospect_id).order("confidence", { ascending: false }).limit(20);

    let config: Record<string, unknown> | null = null;
    const { data: exactConfig } = await supabase
      .from("consultoria_config").select("system_prompt, criterios_qualificacao, nicho")
      .ilike("nicho", prospect.nicho).maybeSingle();

    if (exactConfig) {
      config = exactConfig;
    } else {
      const { data: allConfigs } = await supabase
        .from("consultoria_config").select("system_prompt, criterios_qualificacao, nicho");
      if (allConfigs?.length) {
        const nichoLower = prospect.nicho.toLowerCase().trim();
        config = allConfigs.find((c: Record<string, unknown>) => {
          const cn = (c.nicho as string).toLowerCase().trim();
          return nichoLower.includes(cn) || cn.includes(nichoLower);
        }) ?? null;
      }
    }

    const historico = conversas?.length
      ? conversas.map((m) => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`).join("\n")
      : "Nenhuma conversa registrada ainda.";

    const memoryBlock = memories?.length
      ? "\n\nFatos conhecidos sobre este prospect:\n" + memories.map(m => `- ${m.fact_key}: ${m.fact_value} (confiança: ${m.confidence})`).join("\n")
      : "";

    const systemPrompt = `Você é um especialista em qualificação de vendas B2B usando metodologia MEDDIC.

IMPORTANTE: Classifique este prospect EXCLUSIVAMENTE com base no nicho "${prospect.nicho}".
${config?.system_prompt ? `\nContexto específico do nicho "${config.nicho}":\n${config.system_prompt}` : ""}

Analise os dados e histórico de conversa para:
1. Classificar o prospect como quente/morno/frio com score 0-100
2. Avaliar cada pilar MEDDIC com score 0-100, citação direta como evidência, e nível de confiança 0-1

Pilares MEDDIC:
- Metrics: impacto quantificável que o prospect mencionou
- Economic Buyer: decisor com poder de compra identificado
- Decision Criteria: critérios de escolha revelados
- Decision Process: processo de compra mapeado
- Identify Pain: dor explicitamente articulada
- Champion: defensor interno identificado

Use citações DIRETAS do histórico como evidência. Se não houver evidência, score = 0 e evidence = "Sem evidência no histórico".`;

    const userMessage = `Prospect: ${prospect.nome_negocio}
Nicho: ${prospect.nicho}
Cidade: ${prospect.cidade}
Decisor: ${prospect.decisor ?? "não informado"}
Faturamento estimado: ${prospect.faturamento_estimado ?? "não informado"}
Status no pipeline: ${prospect.status}
Dia de cadência: D${prospect.dia_cadencia ?? 0}
Observações: ${prospect.observacoes ?? "nenhuma"}
${memoryBlock}

Histórico de conversa:
${historico}`;

    const { callClaude } = await import("../_shared/ai-client.ts");

    let result: any;
    try {
      const aiResult = await callClaude({
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [{
          name: "classify_prospect_meddic",
          description: "Classifica prospect com MEDDIC estruturado e classificação geral",
          input_schema: MEDDIC_TOOL.function.parameters,
        }],
        tool_choice: { type: "tool", name: "classify_prospect_meddic" },
        max_tokens: 2048,
      });

      if (!aiResult.toolUse) throw new Error("AI não retornou tool use");
      result = aiResult.toolUse.input;
    } catch (aiErr: any) {
      if (aiErr.message === "RATE_LIMIT") {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw aiErr;
    }

    await supabase
      .from("consultoria_prospects")
      .update({
        classificacao_ia: result.classificacao,
        score_qualificacao: result.score,
        resumo_conversa: result.resumo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospect_id);

    const meddicRows = Object.entries(result.meddic).map(([pilar, data]: [string, any]) => ({
      prospect_id,
      pilar,
      score: data.score,
      evidencia_citacao: data.evidence,
      confianca: data.confidence,
      updated_at: new Date().toISOString(),
    }));

    for (const row of meddicRows) {
      await supabase.from("prospect_meddic").upsert(row, { onConflict: "prospect_id,pilar" });
    }

    if (conversas?.length) {
      await supabase.from("consultoria_conversas").update({ processado_ia: true }).eq("prospect_id", prospect_id);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[classify] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
