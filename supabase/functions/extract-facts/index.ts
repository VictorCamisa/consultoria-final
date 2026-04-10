/**
 * Extrai fatos-chave de mensagens de prospect e salva na Session Memory.
 * Chamado após cada mensagem recebida.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_facts",
    description: "Extrai fatos-chave de uma conversa com prospect",
    parameters: {
      type: "object",
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "Categoria do fato: decisor, equipe, orcamento, dor, concorrente, processo_compra, timeline, ferramenta, objecao, interesse" },
              value: { type: "string", description: "O fato extraído, conciso e factual" },
              confidence: { type: "number", description: "Confiança 0-1 de que o fato é correto" }
            },
            required: ["key", "value", "confidence"],
            additionalProperties: false
          }
        }
      },
      required: ["facts"],
      additionalProperties: false
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id, message_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: messages } = await supabase
      .from("consultoria_conversas").select("id, direcao, conteudo, message_id, created_at")
      .eq("prospect_id", prospect_id).eq("direcao", "entrada")
      .order("created_at", { ascending: false }).limit(5);

    if (!messages?.length) {
      return new Response(JSON.stringify({ success: true, facts_extracted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prospect } = await supabase
      .from("consultoria_prospects").select("nome_negocio, nicho")
      .eq("id", prospect_id).single();

    const { data: existingFacts } = await supabase
      .from("prospect_session_memory").select("fact_key, fact_value")
      .eq("prospect_id", prospect_id);

    const existingBlock = existingFacts?.length
      ? "\n\nFatos JÁ CONHECIDOS (não extraia duplicatas):\n" + existingFacts.map(f => `• ${f.fact_key}: ${f.fact_value}`).join("\n")
      : "";

    const msgsText = messages.map(m => m.conteudo).join("\n\n");

    const systemPrompt = `Você é um analista de conversas comerciais. Extraia fatos-chave das mensagens do prospect.

Categorias válidas:
- decisor: nome/cargo do decisor
- equipe: tamanho da equipe, quem faz o quê
- orcamento: informações sobre orçamento, investimento, capacidade financeira
- dor: problemas, frustrações, desafios mencionados
- concorrente: menção a concorrentes ou soluções atuais
- processo_compra: como decidem, quem aprova, timeline
- timeline: urgência, datas, prazos mencionados
- ferramenta: sistemas, ferramentas, plataformas usados
- objecao: resistências, preocupações levantadas
- interesse: o que chamou atenção, o que quer saber mais

Regras:
- Extraia APENAS fatos explícitos — não infira
- Seja conciso e factual
- Confiança alta (0.8-1.0) para declarações diretas
- Confiança média (0.5-0.7) para inferências razoáveis
- Se não houver fatos extraíveis, retorne array vazio
- NÃO repita fatos já conhecidos

Nicho: ${prospect?.nicho ?? "desconhecido"}`;

    const aiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mensagens do prospect "${prospect?.nome_negocio ?? "?"}":\n\n${msgsText}${existingBlock}` },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_facts" } },
      }),
    });

    if (!aiRes.ok) {
      console.error("[extract-facts] AI error:", await aiRes.text());
      return new Response(JSON.stringify({ success: false, error: "AI indisponível" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ success: true, facts_extracted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { facts } = JSON.parse(toolCall.function.arguments);

    if (facts?.length) {
      const rows = facts.map((f: { key: string; value: string; confidence: number }) => ({
        prospect_id,
        fact_key: f.key,
        fact_value: f.value,
        confidence: f.confidence,
        source_message_id: message_id ?? null,
      }));
      await supabase.from("prospect_session_memory").insert(rows);
    }

    console.log(`[extract-facts] ${prospect?.nome_negocio}: ${facts?.length ?? 0} fatos extraídos`);

    return new Response(JSON.stringify({ success: true, facts_extracted: facts?.length ?? 0, facts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-facts] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
