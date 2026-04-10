/**
 * Envia script de abordagem inicial para prospect via Evolution API.
 * Integra: máquina de estados, validador anti-eco, checkpointing, validação onWhatsApp.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, resolveSendInstance } from "../_shared/instance-resolver.ts";


async function findConfig(supabase: ReturnType<typeof createClient>, nicho: string) {
  const { data: exactConfig } = await supabase
    .from("consultoria_config")
    .select("*")
    .ilike("nicho", nicho)
    .maybeSingle();
  if (exactConfig) return exactConfig;

  const { data: allConfigs } = await supabase
    .from("consultoria_config")
    .select("*");
  if (!allConfigs?.length) return null;

  const nichoLower = nicho.toLowerCase().trim();
  return allConfigs.find((c: Record<string, unknown>) => {
    const cn = (c.nicho as string).toLowerCase().trim();
    return nichoLower.includes(cn) || cn.includes(nichoLower);
  }) ?? null;
}

async function upsertState(
  supabase: ReturnType<typeof createClient>,
  prospectId: string,
  step: string,
  completedSteps: string[],
  status: string,
  context: Record<string, unknown> = {},
  error?: string
) {
  await supabase.from("prospect_execution_state").upsert({
    prospect_id: prospectId,
    current_step: step,
    completed_steps: completedSteps,
    status,
    context_snapshot: context,
    error: error ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "prospect_id" });
}

/** Validate number exists on WhatsApp via Evolution API */
async function checkWhatsAppExists(
  evolutionUrl: string,
  evolutionKey: string,
  instance: string,
  phone: string
): Promise<{ exists: boolean; jid?: string }> {
  try {
    const res = await fetch(`${evolutionUrl}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[abordar] onWhatsApp check failed (${res.status}): ${errText}`);
      // Try to parse error for exists: false pattern
      try {
        const parsed = JSON.parse(errText);
        const msg = parsed?.response?.message;
        if (Array.isArray(msg) && msg.length > 0 && msg[0].exists === false) {
          return { exists: false };
        }
      } catch { /* ignore parse error */ }
      return { exists: false };
    }
    const data = await res.json();
    // Response is array: [{ exists: true, jid: "...", number: "..." }]
    const result = Array.isArray(data) ? data[0] : data;
    return { exists: result?.exists === true, jid: result?.jid };
  } catch (e) {
    console.error("[abordar] onWhatsApp check error:", e);
    return { exists: false };
  }
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

    // Checkpoint: draft
    await upsertState(supabase, prospect_id, "draft", [], "in_progress");

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    const config = await findConfig(supabase, prospect.nicho);

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const instancia = await resolveSendInstance(supabase, prospect);

    // === PRE-VALIDATION: Check if number exists on WhatsApp ===
    if (evolutionUrl && evolutionKey && instancia) {
      const phone = normalizePhone(prospect.whatsapp);
      const whatsappCheck = await checkWhatsAppExists(evolutionUrl, evolutionKey, instancia, phone);

      if (!whatsappCheck.exists) {
        console.log(`[abordar] Número ${phone} NÃO existe no WhatsApp — abortando`);

        // Mark as invalid in DB
        await supabase.from("consultoria_prospects").update({
          whatsapp_valido: false,
          updated_at: new Date().toISOString(),
        }).eq("id", prospect_id);

        // Checkpoint: failed
        await upsertState(supabase, prospect_id, "validate_number", ["draft"], "failed", {
          reason: "numero_invalido", phone
        }, "Número não encontrado no WhatsApp");

        return new Response(
          JSON.stringify({
            success: false,
            enviado: false,
            reason: "numero_invalido",
            message: `Número ${prospect.whatsapp} não encontrado no WhatsApp`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Number is valid — cache it
      await supabase.from("consultoria_prospects").update({
        whatsapp_valido: true,
      }).eq("id", prospect_id);
    }

    // Fallback genérico quando não há config para o nicho
    const genericScripts: Record<string, string> = {
      a: `Olá{{decisor_greeting}}! Tudo bem? Sou da VS Growth Hub. Gostaria de entender melhor o seu negócio{{cidade_ref}}. Posso te fazer algumas perguntas rápidas para ver se consigo te ajudar a crescer?`,
      b: `{{decisor_greeting}}, boa tarde! Aqui é da VS Growth Hub. Estamos ajudando empresas a otimizar marketing e vendas. Você teria 2 minutos para eu entender seus principais desafios hoje?`,
      c: `Oi{{decisor_greeting}}! Tudo certo? Sou consultor da VS Growth Hub. Queria entender: qual o maior gargalo do seu negócio hoje quando o assunto é atrair e converter clientes?`,
    };

    let mensagem: string;
    let configNicho = "genérico";

    if (config) {
      configNicho = config.nicho as string;
      const scriptMap: Record<string, string> = {
        a: (config.script_a as string) ?? "",
        b: (config.script_b as string) ?? "",
        c: (config.script_c as string) ?? "",
      };
      mensagem = scriptMap[script.toLowerCase()] || genericScripts[script.toLowerCase()] || genericScripts.a;
    } else {
      console.log(`[abordar] Sem config para nicho "${prospect.nicho}" — usando script genérico`);
      mensagem = genericScripts[script.toLowerCase()] || genericScripts.a;
    }

    // Sanitiza valores de placeholder
    const decisorNome = (prospect.decisor && prospect.decisor !== prospect.nome_negocio && prospect.decisor !== "Não informado")
      ? prospect.decisor : "";
    const cidadeValida = (prospect.cidade && !["não informada", "não informado", ""].includes(prospect.cidade.toLowerCase().trim()))
      ? prospect.cidade : "";

    mensagem = mensagem
      .replace(/\{\{decisor_greeting\}\}/gi, decisorNome ? `, ${decisorNome}` : "")
      .replace(/\{\{cidade_ref\}\}/gi, cidadeValida ? ` em ${cidadeValida}` : "")
      .replace(/\{\{nome\}\}/gi, prospect.nome_negocio)
      .replace(/\{\{decisor\}\}/gi, decisorNome || "")
      .replace(/\{\{cidade\}\}/gi, cidadeValida);

    // Checkpoint: validate
    await upsertState(supabase, prospect_id, "validate", ["draft"], "in_progress", { script, mensagem_original: mensagem });

    // Chama validador anti-eco
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      const validateRes = await fetch(`${baseUrl}/functions/v1/validate-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ prospect_id, mensagem }),
      });

      if (validateRes.ok) {
        const validation = await validateRes.json();
        if (!validation.approved && validation.revised_message) {
          console.log(`[abordar] Mensagem revisada pelo validador: ${validation.reason}`);
          mensagem = validation.revised_message;
        }
      }
    } catch (e) {
      console.warn("[abordar] Validador indisponível, prosseguindo:", e);
    }

    // Checkpoint: send
    await upsertState(supabase, prospect_id, "send", ["draft", "validate"], "in_progress", { mensagem_final: mensagem });

    let messageId: string | null = null;
    let enviado = false;

    if (!evolutionUrl || !evolutionKey) {
      console.log("[abordar] Evolution não configurado — salvando sem enviar");
    } else if (!instancia) {
      console.log("[abordar] instancia_evolution vazia — salvando sem enviar");
    } else {
      const brTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const hora = new Date(brTime).getHours();
      const horaInicio = config ? (config.horario_inicio as number) ?? 8 : 8;
      const horaFim = config ? (config.horario_fim as number) ?? 18 : 18;
      if (hora < horaInicio || hora >= horaFim) {
        await upsertState(supabase, prospect_id, "send", ["draft", "validate"], "pending", { reason: "fora_horario" });
        return new Response(
          JSON.stringify({ success: false, enviado: false, reason: "fora_horario", message: `Fora do horário (${horaInicio}h-${horaFim}h)` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phone = normalizePhone(prospect.whatsapp);

      const evoRes = await fetch(`${evolutionUrl}/message/sendText/${instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionKey },
        body: JSON.stringify({ number: phone, text: mensagem }),
      });

      if (evoRes.ok) {
        const evoData = await evoRes.json();
        messageId = evoData?.key?.id ?? null;
        enviado = true;
      } else {
        const errText = await evoRes.text();
        console.error(`[abordar] Evolution error (${evoRes.status}): ${errText}`);

        // Check if error is "number does not exist on WhatsApp"
        try {
          const parsed = JSON.parse(errText);
          const msg = parsed?.response?.message;
          if (Array.isArray(msg) && msg.length > 0 && msg[0].exists === false) {
            await supabase.from("consultoria_prospects").update({
              whatsapp_valido: false,
              updated_at: new Date().toISOString(),
            }).eq("id", prospect_id);

            await upsertState(supabase, prospect_id, "send", ["draft", "validate"], "failed", {
              reason: "numero_invalido"
            }, "Número não existe no WhatsApp");

            return new Response(
              JSON.stringify({
                success: false,
                enviado: false,
                reason: "numero_invalido",
                message: `Número ${prospect.whatsapp} não encontrado no WhatsApp`,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch { /* not a JSON error, continue normally */ }
      }
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await supabase.from("consultoria_conversas").insert({
      prospect_id, direcao: "saida", conteudo: mensagem, message_id: messageId, processado_ia: false,
      origem: "system_send", instance_name: instancia || null,
    });

    await supabase.from("consultoria_cadencia").insert({
      prospect_id, dia: 0, status: enviado ? "enviado" : "pendente_envio",
      enviado_em: enviado ? now.toISOString() : null, mensagem_enviada: mensagem,
      script_usado: `script_${script}`, agendado_para: now.toISOString(),
    });

    await supabase.from("consultoria_prospects").update({
      status: "abordado", script_usado: `script_${script}`,
      data_abordagem: now.toISOString().split("T")[0], dia_cadencia: 1,
      data_proxima_acao: tomorrow.toISOString(), data_ultima_interacao: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", prospect_id);

    // Checkpoint: complete
    await upsertState(supabase, prospect_id, "await_reply", ["draft", "validate", "send"], "completed", {
      enviado, message_id: messageId, config_nicho: configNicho
    });

    return new Response(
      JSON.stringify({ success: true, enviado, message_id: messageId, config_nicho: configNicho }),
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
