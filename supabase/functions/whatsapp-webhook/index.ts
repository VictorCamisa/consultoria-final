/**
 * Evolution API Webhook Handler
 *
 * Melhorias:
 *   - Quando o lead responde, gera resposta automática via suggest-reply e envia
 *   - Verifica se prospect está em cadência ativa para continuar conversa
 *   - Delay antes de auto-reply para parecer natural (5-15s)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    if (key?.fromMe === true) {
      return new Response(JSON.stringify({ skipped: true, reason: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Busca prospect pelo número
    const { data: prospects } = await supabase
      .from("consultoria_prospects")
      .select("id, nicho, status, whatsapp, nome_negocio, dia_cadencia")
      .or(
        `whatsapp.eq.${rawPhone},whatsapp.eq.+${rawPhone},whatsapp.eq.55${rawPhone.slice(-11)}`
      )
      .limit(1);

    if (!prospects || prospects.length === 0) {
      console.warn(`[webhook] Número desconhecido: ${rawPhone}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "prospect_not_found", phone: rawPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prospect = prospects[0];

    // Dedup
    if (messageId) {
      const { data: existente } = await supabase
        .from("consultoria_conversas")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existente) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "duplicate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Salva mensagem recebida
    await supabase.from("consultoria_conversas").insert({
      prospect_id: prospect.id,
      direcao: "entrada",
      conteudo,
      message_id: messageId,
      processado_ia: false,
    });

    // Atualiza status: se estava em cadência/abordado → respondeu
    const now = new Date().toISOString();
    const shouldUpdateStatus = ["abordado", "em_cadencia"].includes(prospect.status);
    await supabase
      .from("consultoria_prospects")
      .update({
        data_ultima_interacao: now,
        status: shouldUpdateStatus ? "respondeu" : prospect.status,
        updated_at: now,
      })
      .eq("id", prospect.id);

    // Dispara classificação IA em background
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    fetch(`${baseUrl}/functions/v1/classify-prospect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ prospect_id: prospect.id }),
    }).catch((e) => console.error("[webhook] Classify error:", e));

    // AUTO-REPLY: Se o prospect estava em cadência ativa, gera e envia resposta
    // contextualizada automaticamente (com delay para parecer natural)
    if (shouldUpdateStatus && conteudo !== "[mídia não suportada]") {
      console.log(`[webhook] Auto-reply para ${prospect.nome_negocio} (${prospect.nicho})`);

      // Dispara auto-reply em background (não bloqueia o webhook)
      (async () => {
        try {
          // Delay de 5-15 segundos para parecer natural
          await new Promise((r) => setTimeout(r, 5000 + Math.random() * 10000));

          // Verifica horário permitido
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

          // Gera sugestão de resposta via suggest-reply
          const suggestRes = await fetch(`${baseUrl}/functions/v1/suggest-reply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ prospect_id: prospect.id }),
          });

          if (!suggestRes.ok) {
            console.error("[webhook] suggest-reply falhou:", await suggestRes.text());
            return;
          }

          const suggestData = await suggestRes.json();
          const resposta = suggestData?.sugestao;

          if (!resposta) {
            console.warn("[webhook] suggest-reply não retornou sugestão");
            return;
          }

          // Envia via send-whatsapp
          const sendRes = await fetch(`${baseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              prospect_id: prospect.id,
              mensagem: resposta,
            }),
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
      JSON.stringify({ success: true, prospect_id: prospect.id, auto_reply: shouldUpdateStatus }),
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
