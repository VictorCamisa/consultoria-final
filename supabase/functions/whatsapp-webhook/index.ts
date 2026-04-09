/**
 * Evolution API Webhook Handler
 * Integra: HITL com gatilhos de handoff, extração de fatos, validação anti-eco.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Gatilhos HITL
function detectHandoffTrigger(
  conteudo: string,
  prospect: { status: string; classificacao_ia: string | null; score_qualificacao: number | null },
  turnsSemResolucao: number
): { triggered: boolean; reason: string } {
  const lower = conteudo.toLowerCase();

  // Gatilho 1: Pedido explícito de falar com humano
  if (/falar com (alguém|pessoa|humano|responsável|dono|gerente|quem decide)/i.test(lower) ||
      /quero (conversar|falar) com (vocês|uma pessoa)/i.test(lower) ||
      /tem alguém (aí|real|de verdade)/i.test(lower)) {
    return { triggered: true, reason: "prospect_pediu_humano" };
  }

  // Gatilho 2: 3+ turnos sem resolução
  if (turnsSemResolucao >= 3) {
    return { triggered: true, reason: "repeticao_sem_resolucao" };
  }

  // Gatilho 3: Alto valor (quente + score > 70)
  if (prospect.classificacao_ia === "quente" && (prospect.score_qualificacao ?? 0) > 70) {
    return { triggered: true, reason: "alto_valor_quente" };
  }

  return { triggered: false, reason: "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (webhookSecret) {
      const authHeader = req.headers.get("apikey") ?? req.headers.get("x-webhook-secret");
      if (authHeader !== webhookSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const event = payload.event as string;

    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ skipped: true, event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;
    const key = data?.key;

    const isFromMe = key?.fromMe === true;

    const remoteJid: string = key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ skipped: true, reason: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawPhone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const msgContent = data?.message;
    const conteudo: string =
      msgContent?.conversation ??
      msgContent?.extendedTextMessage?.text ??
      msgContent?.imageMessage?.caption ??
      "[mídia não suportada]";
    const messageId: string = key?.id ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospects } = await supabase
      .from("consultoria_prospects")
      .select("id, nicho, status, whatsapp, nome_negocio, dia_cadencia, classificacao_ia, score_qualificacao")
      .or(`whatsapp.eq.${rawPhone},whatsapp.eq.+${rawPhone},whatsapp.eq.55${rawPhone.slice(-11)}`)
      .limit(1);

    if (!prospects?.length) {
      console.warn(`[webhook] Número desconhecido: ${rawPhone}`);
      return new Response(JSON.stringify({ skipped: true, reason: "prospect_not_found", phone: rawPhone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prospect = prospects[0];

    // Dedup robusto: tenta inserir e detecta conflito pelo message_id
    if (messageId) {
      const { data: existente } = await supabase
        .from("consultoria_conversas")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      if (existente) {
        return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Salva mensagem — fromMe = saida, senão = entrada
    const direcao = isFromMe ? "saida" : "entrada";
    const { error: insertErr } = await supabase.from("consultoria_conversas").insert({
      prospect_id: prospect.id, direcao, conteudo, message_id: messageId, processado_ia: isFromMe,
    });

    // Se falhar por duplicata (race condition), ignora
    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message?.includes("duplicate")) {
        return new Response(JSON.stringify({ skipped: true, reason: "duplicate_race" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[webhook] Insert error:", insertErr);
    }

    // Dedup extra para auto-reply: verifica se já enviamos saída nos últimos 30s
    const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recentOutbound } = await supabase
      .from("consultoria_conversas")
      .select("id")
      .eq("prospect_id", prospect.id)
      .eq("direcao", "saida")
      .gte("created_at", thirtySecsAgo)
      .limit(1);
    const skipAutoReply = (recentOutbound?.length ?? 0) > 0;

    const now = new Date().toISOString();
    const shouldUpdateStatus = ["abordado", "em_cadencia"].includes(prospect.status);

    await supabase.from("consultoria_prospects").update({
      data_ultima_interacao: now,
      status: shouldUpdateStatus ? "respondeu" : prospect.status,
      updated_at: now,
    }).eq("id", prospect.id);

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Dispara classificação + extração de fatos em background
    fetch(`${baseUrl}/functions/v1/classify-prospect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ prospect_id: prospect.id }),
    }).catch((e) => console.error("[webhook] Classify error:", e));

    fetch(`${baseUrl}/functions/v1/extract-facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ prospect_id: prospect.id, message_id: messageId }),
    }).catch((e) => console.error("[webhook] Extract-facts error:", e));

    // HITL: Verifica gatilhos de handoff
    let handoffTriggered = false;
    if (shouldUpdateStatus && conteudo !== "[mídia não suportada]") {
      // Conta turnos recentes sem resolução (saída VS → entrada prospect sem avanço)
      const { data: recentMsgs } = await supabase
        .from("consultoria_conversas")
        .select("direcao")
        .eq("prospect_id", prospect.id)
        .order("created_at", { ascending: false })
        .limit(10);

      let turnsSemResolucao = 0;
      if (recentMsgs) {
        let lastDir = "";
        for (const msg of recentMsgs) {
          if (msg.direcao === "entrada" && lastDir === "saida") turnsSemResolucao++;
          if (msg.direcao === "entrada" && lastDir === "entrada") break;
          lastDir = msg.direcao;
        }
      }

      const handoff = detectHandoffTrigger(conteudo, prospect, turnsSemResolucao);

      if (handoff.triggered) {
        handoffTriggered = true;
        console.log(`[webhook] HITL HANDOFF: ${prospect.nome_negocio} — ${handoff.reason}`);

        await supabase.from("consultoria_prospects").update({
          status: "aguardando_humano",
          handoff_reason: handoff.reason,
          handoff_at: now,
          updated_at: now,
        }).eq("id", prospect.id);

        // Atualiza estado
        await supabase.from("prospect_execution_state").upsert({
          prospect_id: prospect.id,
          current_step: "handoff",
          completed_steps: ["research", "classify", "draft", "validate", "send", "await_reply", "qualify"],
          status: "handoff",
          context_snapshot: { reason: handoff.reason, last_message: conteudo },
          updated_at: now,
        }, { onConflict: "prospect_id" });
      }
    }

    // AUTO-REPLY: Só se não houve handoff e não é duplicata
    if (shouldUpdateStatus && !handoffTriggered && !skipAutoReply && conteudo !== "[mídia não suportada]") {
      console.log(`[webhook] Auto-reply para ${prospect.nome_negocio} (${prospect.nicho})`);

      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));

          const hora = new Date().getHours();
          const { data: config } = await supabase
            .from("consultoria_config")
            .select("horario_inicio, horario_fim, instancia_evolution")
            .ilike("nicho", prospect.nicho)
            .maybeSingle();

          const horaInicio = config?.horario_inicio ?? 8;
          const horaFim = config?.horario_fim ?? 18;
          if (hora < horaInicio || hora >= horaFim) {
            console.log(`[webhook] Auto-reply cancelado: fora do horário (${hora}h)`);
            return;
          }

          // Gera sugestão
          const suggestRes = await fetch(`${baseUrl}/functions/v1/suggest-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ prospect_id: prospect.id }),
          });

          if (!suggestRes.ok) {
            console.error("[webhook] suggest-reply falhou:", await suggestRes.text());
            return;
          }

          const { sugestao: resposta } = await suggestRes.json();
          if (!resposta) return;

          // Valida com anti-eco
          let mensagemFinal = resposta;
          try {
            const validateRes = await fetch(`${baseUrl}/functions/v1/validate-message`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ prospect_id: prospect.id, mensagem: resposta }),
            });

            if (validateRes.ok) {
              const validation = await validateRes.json();
              if (!validation.approved && validation.revised_message) {
                mensagemFinal = validation.revised_message;
                console.log(`[webhook] Mensagem revisada pelo validador`);
              } else if (!validation.approved && !validation.revised_message) {
                console.log(`[webhook] Mensagem reprovada sem revisão, cancelando auto-reply`);
                return;
              }
            }
          } catch (e) {
            console.warn("[webhook] Validador indisponível, prosseguindo:", e);
          }

          // Envia
          const sendRes = await fetch(`${baseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ prospect_id: prospect.id, mensagem: mensagemFinal }),
          });

          if (sendRes.ok) {
            console.log(`[webhook] Auto-reply enviado para ${prospect.nome_negocio}`);
          } else {
            console.error("[webhook] send-whatsapp falhou:", await sendRes.text());
          }
        } catch (e) {
          console.error("[webhook] Auto-reply error:", e);
        }
      })();
    }

    return new Response(
      JSON.stringify({ success: true, prospect_id: prospect.id, auto_reply: shouldUpdateStatus && !handoffTriggered, handoff: handoffTriggered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
