/**
 * Vendedor Chat — Simulador de treinamento de vendas.
 * Migrado para Lovable AI Gateway.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profile, scenario, knowledge } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemParts: string[] = [];
    systemParts.push(`Você é um cliente simulado para treino de vendas. Seu papel é agir como um potencial cliente que está sendo abordado por um vendedor.`);

    if (scenario?.customer_persona) systemParts.push(`\n## Seu Perfil de Cliente:\n${scenario.customer_persona}`);
    if (scenario?.description) systemParts.push(`\n## Cenário:\n${scenario.description}`);

    if (scenario?.difficulty) {
      const diffMap: Record<string, string> = {
        facil: "Você é um cliente receptivo, interessado no produto/serviço. Faz perguntas mas está aberto a comprar. Seja amigável.",
        medio: "Você é um cliente neutro, tem interesse mas precisa ser convencido. Faça objeções moderadas e peça mais detalhes antes de decidir.",
        dificil: "Você é um cliente difícil e cético. Questione tudo, faça objeções fortes, compare com concorrentes, reclame de preço. Não ceda fácil.",
      };
      systemParts.push(`\n## Nível de Dificuldade:\n${diffMap[scenario.difficulty] || diffMap.medio}`);
    }

    if (profile) {
      systemParts.push(`\n## Sobre a Empresa que está te vendendo:`);
      if (profile.company_name) systemParts.push(`- Empresa: ${profile.company_name}`);
      if (profile.segment) systemParts.push(`- Segmento: ${profile.segment}`);
      if (profile.products_services) systemParts.push(`- Produtos/Serviços: ${profile.products_services}`);
      if (profile.target_audience) systemParts.push(`- Público-alvo: ${profile.target_audience}`);
      if (profile.common_objections) systemParts.push(`\n## Objeções que você pode usar:\n${profile.common_objections}`);
    }

    if (scenario?.system_prompt) systemParts.push(`\n## Instruções adicionais:\n${scenario.system_prompt}`);

    if (knowledge?.length) {
      systemParts.push(`\n## Aprendizados anteriores do vendedor:`);
      knowledge.forEach((k: { title: string; content: string; category: string }, i: number) => {
        systemParts.push(`${i + 1}. [${k.category}] ${k.title}: ${k.content}`);
      });
    }

    systemParts.push(`\n## Regras:`);
    systemParts.push(`- Responda sempre em português brasileiro`);
    systemParts.push(`- Aja naturalmente como um cliente real por WhatsApp (mensagens curtas, informais)`);
    systemParts.push(`- NÃO revele que você é uma IA ou simulação`);
    systemParts.push(`- Reaja de acordo com o nível de dificuldade definido`);
    systemParts.push(`- Use os aprendizados anteriores para testar os pontos fracos do vendedor`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemParts.join("\n") },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("vendedor-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
