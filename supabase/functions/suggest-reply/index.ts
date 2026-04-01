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
      .order("created_at", { ascending: false })
      .limit(20);

    // Match seguro de config por nicho
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

    if (config) {
      console.log(`[suggest] Prospect "${prospect.nome_negocio}" (${prospect.nicho}) → config "${config.nicho}"`);
    }

    const historico =
      conversas && conversas.length > 0
        ? [...conversas]
            .reverse()
            .map((m) => `[${m.direcao === "saida" ? "VS" : "Prospect"}] ${m.conteudo}`)
            .join("\n")
        : "Nenhuma conversa anterior.";

    let scriptSugerido = "";
    if (config) {
      const dia = prospect.dia_cadencia ?? 0;
      if (dia === 0 && prospect.status === "novo")
        scriptSugerido = `Scripts disponíveis:\nA: ${config.script_a}\nB: ${config.script_b}\nC: ${config.script_c}`;
      else if (dia <= 1) scriptSugerido = `Follow-up D1: ${config.followup_d1}`;
      else if (dia <= 3) scriptSugerido = `Follow-up D3: ${config.followup_d3}`;
      else if (dia <= 7) scriptSugerido = `Follow-up D7: ${config.followup_d7}`;
      else if (dia <= 14) scriptSugerido = `Follow-up D14: ${config.followup_d14}`;
      else scriptSugerido = `Follow-up D30: ${config.followup_d30}`;
    }

    const systemPrompt = `${config?.system_prompt ?? "Você é um especialista em vendas consultivas para o mercado brasileiro."}

IMPORTANTE: Este prospect é do nicho "${prospect.nicho}". Adapte completamente sua linguagem e referências ao contexto deste nicho específico. NÃO misture referências de outros nichos.

Sua tarefa é sugerir a próxima mensagem de WhatsApp para enviar ao prospect.

Regras:
- Escreva em português informal e natural, como uma conversa real de WhatsApp
- Seja direto, sem enrolação e sem emojis excessivos (no máximo 1-2 por mensagem)
- Máximo 3 parágrafos curtos
- O objetivo é avançar o prospect no pipeline (marcar call, gerar interesse, reativar conversa)
- Adapte ao contexto da conversa — se o prospect respondeu, CONTINUE a conversa de forma natural
- Se o prospect fez uma pergunta, RESPONDA a pergunta antes de tentar avançar
- Se o prospect demonstrou interesse, proponha um próximo passo concreto (call, reunião)
- Se o prospect mostrou objeção, trate a objeção com empatia

${scriptSugerido ? `\nReferência de scripts (use como base, mas adapte ao contexto):\n${scriptSugerido}` : ""}

Responda APENAS com o texto da mensagem sugerida, sem aspas, sem explicações.`;

    const userMessage = `Prospect: ${prospect.nome_negocio} (${prospect.nicho} — ${prospect.cidade})
Status: ${prospect.status} | Dia cadência: D${prospect.dia_cadencia ?? 0}
Decisor: ${prospect.decisor ?? "não identificado"}
Faturamento: ${prospect.faturamento_estimado ?? "não informado"}
Classificação IA: ${prospect.classificacao_ia ?? "não classificado"}

Histórico (cronológico):
${historico}`;

    const openaiRes = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
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
    const sugestao = openaiData.choices[0].message.content.trim();

    return new Response(JSON.stringify({ success: true, sugestao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
