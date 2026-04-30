import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a diretora de conteúdo da VS Growth Hub — consultoria brasileira de marketing e vendas para PMEs (Estética, Odonto, Advocacia, Revendas de Veículos / VS AUTO).

IDENTIDADE VS:
• Nome: VS Growth Hub (sempre)
• Filosofia: "Ecossistemas Digitais que vendem por você" — automação, IA e processo comercial
• Público: donos de PMEs que perdem leads, não fazem follow-up e dependem demais do dono na operação
• Tom: técnico, direto, consultivo, B2B. Nunca "fofo", nunca "vendedor de curso", nunca clichê de coach
• Cores e mood: VS Blue #2E6FCC, Blue Light #4A8DE0, fundo claro, tipografia Barlow Condensed

REGRAS DE COPY:
1. A legenda DEVE responder ao tema/ideia que o usuário pediu — siga fielmente
2. Linguagem clara, números concretos, cases ou dados quando fizer sentido
3. Emojis: máximo 2, profissionais (📊 📈 ⚙️ 🎯 ✅) — nunca 🔥🚨💥
4. Hashtags: sempre #VSGrowthHub #VendasDeSolucoes + 3-5 do nicho/tema
5. CTA elegante e consultivo (ex: "agende um diagnóstico gratuito", "fale com um especialista")
6. NUNCA invente dados (faturamento, ROI, número de clientes) que não foram informados
7. Legenda CURTA, máximo 4-6 linhas, com pausas estratégicas e quebras de linha

FORMATO (JSON estrito):
{
  "caption": "legenda completa pronta para postar",
  "hashtags": ["lista", "sem", "#"],
  "platform_tips": "dica rápida para a plataforma",
  "visual_suggestion": "sugestão de visual para a foto/arte",
  "best_time": "melhor horário sugerido"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, platform = "Instagram", nicho, brandContext, referenceContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Pull active brand assets from DB (rules, tone, palette)
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

    const sections: string[] = [
      `PEDIDO: "${prompt}"`,
      `PLATAFORMA: ${platform}`,
    ];
    if (nicho) sections.push(`NICHO ALVO: ${nicho}`);
    if (referenceContext) sections.push(`REFERÊNCIAS DE TOM (inspiração apenas):\n${referenceContext}`);
    if (brandContext) sections.push(`DIRETRIZES EXTRAS:\n${brandContext}`);
    if (dbBrandContext) sections.push(`DIRETRIZES SALVAS DA MARCA VS:\n${dbBrandContext}`);
    sections.push("Responda APENAS no JSON especificado. Legenda curta, B2B, consultiva.");

    const userMessage = sections.join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_vs_post",
              description: "Gera um post B2B para a VS Growth Hub seguindo o pedido",
              parameters: {
                type: "object",
                properties: {
                  caption: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  platform_tips: { type: "string" },
                  visual_suggestion: { type: "string" },
                  best_time: { type: "string" },
                },
                required: ["caption", "hashtags", "platform_tips", "visual_suggestion", "best_time"],
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
        return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
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
          caption: content || "",
          hashtags: ["VSGrowthHub", "VendasDeSolucoes"],
          platform_tips: "",
          visual_suggestion: "",
          best_time: "",
        };
      }
    }

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vs-generate-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});