import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

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

    const { data: conversas } = await supabase
      .from("consultoria_conversas")
      .select("direcao, conteudo, created_at")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: true })
      .limit(30);

    // Match seguro de config por nicho (sem fallback cross-nicho)
    let config: Record<string, unknown> | null = null;
    const { data: exactConfig } = await supabase
      .from("consultoria_config")
      .select("system_prompt, criterios_qualificacao, nicho")
      .ilike("nicho", prospect.nicho)
      .maybeSingle();

    if (exactConfig) {
      config = exactConfig;
    } else {
      // Match parcial seguro
      const { data: allConfigs } = await supabase
        .from("consultoria_config")
        .select("system_prompt, criterios_qualificacao, nicho");

      if (allConfigs?.length) {
        const nichoLower = prospect.nicho.toLowerCase().trim();
        config = allConfigs.find((c: Record<string, unknown>) => {
          const cn = (c.nicho as string).toLowerCase().trim();
          return nichoLower.includes(cn) || cn.includes(nichoLower);
        }) ?? null;
      }
    }

    if (config) {
      console.log(`[classify] Prospect "${prospect.nome_negocio}" (${prospect.nicho}) → config "${config.nicho}"`);
    } else {
      console.warn(`[classify] Nenhuma config para nicho "${prospect.nicho}" — usando prompt genérico`);
    }

    const historico =
      conversas && conversas.length > 0
        ? conversas
            .map((m) => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`)
            .join("\n")
        : "Nenhuma conversa registrada ainda.";

    const systemPrompt = `Você é um especialista em qualificação de vendas para a empresa VS Consultoria.

IMPORTANTE: Classifique este prospect EXCLUSIVAMENTE com base no nicho "${prospect.nicho}".
${config?.system_prompt ? `\nContexto específico do nicho "${config.nicho}":\n${config.system_prompt}` : ""}

Sua função é analisar dados de um prospect e classificá-lo com base no nível de interesse e potencial de fechamento.

Responda APENAS com um JSON válido no seguinte formato:
{
  "classificacao": "quente" | "morno" | "frio",
  "score": <número de 0 a 100>,
  "resumo": "<1-2 frases resumindo o estágio da conversa>",
  "motivo": "<motivo curto da classificação>"
}`;

    const userMessage = `Prospect: ${prospect.nome_negocio}
Nicho: ${prospect.nicho}
Cidade: ${prospect.cidade}
Decisor: ${prospect.decisor ?? "não informado"}
Faturamento estimado: ${prospect.faturamento_estimado ?? "não informado"}
Status no pipeline: ${prospect.status}
Dia de cadência: D${prospect.dia_cadencia ?? 0}
Observações: ${prospect.observacoes ?? "nenhuma"}

Histórico de conversa:
${historico}`;

    const openaiRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const openaiData = await openaiRes.json();
    const result = JSON.parse(openaiData.choices[0].message.content);

    await supabase
      .from("consultoria_prospects")
      .update({
        classificacao_ia: result.classificacao,
        score_qualificacao: result.score,
        resumo_conversa: result.resumo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospect_id);

    if (conversas && conversas.length > 0) {
      await supabase
        .from("consultoria_conversas")
        .update({ processado_ia: true })
        .eq("prospect_id", prospect_id);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
