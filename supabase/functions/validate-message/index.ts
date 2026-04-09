/**
 * Validador Anti-Eco — LLM secundário que valida mensagens antes do envio.
 * Verifica: redundância, tom, coerência com nicho, compliance.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const VALIDATION_TOOL = {
  type: "function" as const,
  function: {
    name: "validate_message",
    description: "Valida uma mensagem comercial antes do envio",
    parameters: {
      type: "object",
      properties: {
        approved: { type: "boolean", description: "true se a mensagem é adequada para envio" },
        reason: { type: "string", description: "Motivo da aprovação ou rejeição" },
        issues: {
          type: "array",
          items: { type: "string" },
          description: "Lista de problemas encontrados"
        },
        revised_message: { type: "string", description: "Mensagem revisada (se reprovada). Vazio se aprovada." }
      },
      required: ["approved", "reason", "issues", "revised_message"],
      additionalProperties: false
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id, mensagem } = await req.json();
    if (!prospect_id || !mensagem) throw new Error("prospect_id e mensagem obrigatórios");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect } = await supabase
      .from("consultoria_prospects")
      .select("nome_negocio, nicho, cidade")
      .eq("id", prospect_id)
      .single();

    // Últimas 10 mensagens enviadas pela VS
    const { data: sentMsgs } = await supabase
      .from("consultoria_conversas")
      .select("conteudo")
      .eq("prospect_id", prospect_id)
      .eq("direcao", "saida")
      .order("created_at", { ascending: false })
      .limit(10);

    const previousMessages = sentMsgs?.map(m => m.conteudo).join("\n---\n") ?? "Nenhuma mensagem anterior.";

    const systemPrompt = `Você é um validador de qualidade de mensagens comerciais de WhatsApp.

Analise a mensagem proposta e verifique:

1. REDUNDÂNCIA: A mensagem repete frases, ideias ou estruturas de mensagens anteriores? (Eco da IA)
2. TOM: É natural e humana? Não robótica, não agressiva, não passivo-agressiva?
3. COERÊNCIA: Faz sentido para o nicho "${prospect?.nicho ?? 'desconhecido'}"? Não mistura referências de outros nichos?
4. COMPLIANCE: Não faz promessas financeiras específicas? Não garante resultados? Não pressiona agressivamente?
5. COMPRIMENTO: Adequada para WhatsApp? (máximo ~500 caracteres, 3 parágrafos)

REGRAS CRÍTICAS para revised_message:
- NUNCA use placeholders como [seu nome], [nome do negócio], [cidade], etc. Use SEMPRE os dados reais do prospect fornecidos abaixo.
- O nome do negócio é: "${prospect?.nome_negocio ?? ""}". Use esse nome real na mensagem revisada.
- A cidade é: "${prospect?.cidade ?? ""}". Use a cidade real se necessário.
- Se a mensagem original já contém os dados corretos, mantenha-os na revisão.

Se a mensagem tiver problemas, reescreva uma versão corrigida em revised_message.
Se estiver OK, approved=true e revised_message vazio.`;

    const userMessage = `MENSAGEM PROPOSTA PARA ENVIO:
"${mensagem}"

MENSAGENS ANTERIORES ENVIADAS (para checar redundância):
${previousMessages}

Prospect: ${prospect?.nome_negocio ?? "?"} | Nicho: ${prospect?.nicho ?? "?"} | Cidade: ${prospect?.cidade ?? "?"}`;

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [VALIDATION_TOOL],
        tool_choice: { type: "function", function: { name: "validate_message" } },
      }),
    });

    if (!aiRes.ok) {
      // Se o validador falhar, aprova por padrão (fail-open)
      console.error("[validate] AI error, fail-open:", await aiRes.text());
      return new Response(JSON.stringify({
        approved: true,
        reason: "Validador indisponível — fail-open",
        issues: [],
        revised_message: "",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({
        approved: true,
        reason: "Validador não retornou resultado — fail-open",
        issues: [],
        revised_message: "",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`[validate] ${prospect?.nome_negocio}: ${result.approved ? "APROVADA" : "REPROVADA"} — ${result.reason}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[validate] Error:", (err as Error).message);
    // Fail-open
    return new Response(JSON.stringify({
      approved: true,
      reason: `Erro no validador: ${(err as Error).message}`,
      issues: [],
      revised_message: "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
