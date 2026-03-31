/**
 * Envia o script de abordagem inicial (A, B ou C) para um prospect
 * via Evolution API, salva no histórico e inicia a sequência de cadência.
 *
 * Input: { prospect_id, script?: 'a' | 'b' | 'c' }  (default: 'a')
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id, script = "a" } = await req.json();
    if (!prospect_id) throw new Error("prospect_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca prospect
    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    // Busca config: tenta nicho exato, senão faz busca parcial, senão pega qualquer uma
    let config: Record<string, unknown> | null = null;

    // 1) Match exato
    const { data: exactConfig } = await supabase
      .from("consultoria_config")
      .select("*")
      .eq("nicho", prospect.nicho)
      .maybeSingle();

    if (exactConfig) {
      config = exactConfig;
    } else {
      // 2) Match parcial: nicho do prospect contém o nome da config
      const { data: allConfigs } = await supabase
        .from("consultoria_config")
        .select("*");

      if (allConfigs?.length) {
        const prospectNichoLower = prospect.nicho.toLowerCase();
        config = allConfigs.find((c: Record<string, unknown>) =>
          prospectNichoLower.includes((c.nicho as string).toLowerCase())
        ) ?? null;

        // 3) Fallback: usa a primeira config disponível
        if (!config) {
          config = allConfigs[0];
          console.log(`[abordar] Nicho "${prospect.nicho}" sem config, usando fallback: "${(config as Record<string, unknown>).nicho}"`);
        }
      }
    }

    if (!config) throw new Error(`Nenhuma config encontrada no sistema. Configure pelo menos um nicho em Configurações.`);

    const scriptMap: Record<string, string> = {
      a: (config.script_a as string) ?? "",
      b: (config.script_b as string) ?? "",
      c: (config.script_c as string) ?? "",
    };
    const mensagem = scriptMap[script.toLowerCase()];
    if (!mensagem) throw new Error(`Script "${script}" está vazio na configuração do nicho "${config.nicho}"`);

    // Substitui variável {{nome}} se existir
    const mensagemFinal = mensagem.replace(/\{\{nome\}\}/gi, prospect.nome_negocio);

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instancia = config.instancia_evolution as string;

    let messageId: string | null = null;
    let enviado = false;

    if (!evolutionUrl || !evolutionKey) {
      console.log("[abordar] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados — salvando sem enviar");
    } else if (!instancia) {
      console.log("[abordar] instancia_evolution vazia — salvando sem enviar. Configure uma instância em Configurações > WhatsApp");
    } else {
      const rawPhone = prospect.whatsapp.replace(/\D/g, "");
      const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

      const evoRes = await fetch(
        `${evolutionUrl}/message/sendText/${instancia}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ number: phone, text: mensagemFinal }),
        }
      );

      if (evoRes.ok) {
        const evoData = await evoRes.json();
        messageId = evoData?.key?.id ?? null;
        enviado = true;
      } else {
        const errText = await evoRes.text();
        console.error(`[abordar] Evolution error (${evoRes.status}): ${errText}`);
        // Don't throw — still save the record as pendente_envio
      }
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Salva na conversa
    await supabase.from("consultoria_conversas").insert({
      prospect_id,
      direcao: "saida",
      conteudo: mensagemFinal,
      message_id: messageId,
      processado_ia: false,
    });

    // Registra na cadência como D0
    await supabase.from("consultoria_cadencia").insert({
      prospect_id,
      dia: 0,
      status: enviado ? "enviado" : "pendente_envio",
      enviado_em: enviado ? now.toISOString() : null,
      mensagem_enviada: mensagemFinal,
      script_usado: `script_${script}`,
      agendado_para: now.toISOString(),
    });

    // Atualiza prospect: inicia cadência
    await supabase
      .from("consultoria_prospects")
      .update({
        status: "abordado",
        script_usado: `script_${script}`,
        data_abordagem: now.toISOString().split("T")[0],
        dia_cadencia: 1,
        data_proxima_acao: tomorrow.toISOString(),
        data_ultima_interacao: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", prospect_id);

    return new Response(
      JSON.stringify({ success: true, enviado, message_id: messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[abordar] Error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
