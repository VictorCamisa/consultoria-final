/**
 * Envia o script de abordagem inicial (A, B ou C) para um prospect
 * via Evolution API, salva no histórico e inicia a sequência de cadência.
 *
 * Input: { prospect_id, script?: 'a' | 'b' | 'c' }  (default: 'a')
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Busca a config do nicho com match EXATO.
 * Se não encontrar, retorna null — sem fallback fuzzy para evitar
 * enviar script de estética para advogado.
 */
async function findConfig(supabase: ReturnType<typeof createClient>, nicho: string) {
  // 1) Match exato (case-insensitive via ilike)
  const { data: exactConfig } = await supabase
    .from("consultoria_config")
    .select("*")
    .ilike("nicho", nicho)
    .maybeSingle();

  if (exactConfig) return exactConfig;

  // 2) Match parcial SEGURO: nicho da config deve estar contido no nicho do prospect
  //    Ex: config "Estética" match prospect "Clínicas de Estética"
  //    Mas config "Advocacia" NÃO match prospect "Estética"
  const { data: allConfigs } = await supabase
    .from("consultoria_config")
    .select("*");

  if (!allConfigs?.length) return null;

  const nichoLower = nicho.toLowerCase().trim();
  const match = allConfigs.find((c: Record<string, unknown>) => {
    const configNicho = (c.nicho as string).toLowerCase().trim();
    // O nicho do prospect deve conter o nicho da config
    return nichoLower.includes(configNicho) || configNicho.includes(nichoLower);
  });

  if (match) {
    console.log(`[abordar] Match parcial: prospect "${nicho}" → config "${match.nicho}"`);
    return match;
  }

  console.warn(`[abordar] Nenhuma config encontrada para nicho "${nicho}". Configs disponíveis: ${allConfigs.map((c: Record<string, unknown>) => c.nicho).join(', ')}`);
  return null;
}

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

    // Busca config com match seguro por nicho
    const config = await findConfig(supabase, prospect.nicho);
    if (!config) {
      throw new Error(
        `Nenhuma config encontrada para nicho "${prospect.nicho}". ` +
        `Configure o nicho correto em Configurações.`
      );
    }

    console.log(`[abordar] Prospect "${prospect.nome_negocio}" (${prospect.nicho}) → config "${config.nicho}"`);

    const scriptMap: Record<string, string> = {
      a: (config.script_a as string) ?? "",
      b: (config.script_b as string) ?? "",
      c: (config.script_c as string) ?? "",
    };
    const mensagem = scriptMap[script.toLowerCase()];
    if (!mensagem) throw new Error(`Script "${script}" está vazio na configuração do nicho "${config.nicho}"`);

    // Substitui variáveis
    const mensagemFinal = mensagem
      .replace(/\{\{nome\}\}/gi, prospect.nome_negocio)
      .replace(/\{\{decisor\}\}/gi, prospect.decisor ?? prospect.nome_negocio)
      .replace(/\{\{cidade\}\}/gi, prospect.cidade ?? "");

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instancia = config.instancia_evolution as string;

    let messageId: string | null = null;
    let enviado = false;

    if (!evolutionUrl || !evolutionKey) {
      console.log("[abordar] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados — salvando sem enviar");
    } else if (!instancia) {
      console.log("[abordar] instancia_evolution vazia — salvando sem enviar");
    } else {
      // Respeita janela de horário da config
      const hora = new Date().getHours();
      const horaInicio = (config.horario_inicio as number) ?? 8;
      const horaFim = (config.horario_fim as number) ?? 18;
      if (hora < horaInicio || hora >= horaFim) {
        console.log(`[abordar] Fora do horário permitido (${horaInicio}h-${horaFim}h, atual: ${hora}h)`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            enviado: false, 
            reason: "fora_horario",
            message: `Fora do horário de envio (${horaInicio}h-${horaFim}h)` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
      JSON.stringify({ success: true, enviado, message_id: messageId, config_nicho: config.nicho }),
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
