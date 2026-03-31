/**
 * Evolution API Webhook Handler
 *
 * Configure na Evolution API:
 *   URL: https://<project>.supabase.co/functions/v1/whatsapp-webhook
 *   Events: MESSAGES_UPSERT
 *
 * Variáveis de ambiente necessárias (Supabase Secrets):
 *   WEBHOOK_SECRET - string aleatória para validar origem (configure na Evolution API também)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validação opcional de secret header
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

    // Evolution API v2 envia evento no campo "event"
    const event = payload.event as string;

    // Só processa mensagens recebidas (não de grupos e não enviadas por nós)
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ skipped: true, event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;
    const key = data?.key;

    // Ignora mensagens enviadas por nós mesmos
    if (key?.fromMe === true) {
      return new Response(JSON.stringify({ skipped: true, reason: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignora grupos
    const remoteJid: string = key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ skipped: true, reason: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrai número de telefone (remove @s.whatsapp.net e código de país se necessário)
    const rawPhone = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    // Extrai conteúdo da mensagem (suporta texto simples e extendedText)
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

    // Busca prospect pelo número de WhatsApp
    // O campo whatsapp pode ter diferentes formatos, então tentamos match parcial
    const { data: prospects } = await supabase
      .from("consultoria_prospects")
      .select("id, nicho, status, whatsapp")
      .or(
        `whatsapp.eq.${rawPhone},whatsapp.eq.+${rawPhone},whatsapp.eq.55${rawPhone.slice(-11)}`
      )
      .limit(1);

    if (!prospects || prospects.length === 0) {
      // Prospect não encontrado — registra log mas não falha
      console.warn(`Mensagem recebida de número desconhecido: ${rawPhone}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "prospect_not_found", phone: rawPhone }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prospect = prospects[0];

    // Verifica se mensagem já foi processada (evita duplicatas)
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
    const { error: insertErr } = await supabase
      .from("consultoria_conversas")
      .insert({
        prospect_id: prospect.id,
        direcao: "entrada",
        conteudo,
        message_id: messageId,
        processado_ia: false,
      });

    if (insertErr) throw insertErr;

    // Atualiza data_ultima_interacao do prospect
    const now = new Date().toISOString();
    await supabase
      .from("consultoria_prospects")
      .update({
        data_ultima_interacao: now,
        // Se estava "em_cadencia" ou "abordado" e respondeu, avança para "respondeu"
        status:
          ["abordado", "em_cadencia"].includes(prospect.status)
            ? "respondeu"
            : prospect.status,
        updated_at: now,
      })
      .eq("id", prospect.id);

    // Dispara classificação IA em background (não aguarda resposta)
    const classifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/classify-prospect`;
    fetch(classifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ prospect_id: prospect.id }),
    }).catch((e) => console.error("Classify background error:", e));

    return new Response(
      JSON.stringify({ success: true, prospect_id: prospect.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
