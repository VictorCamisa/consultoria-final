/**
 * Sincroniza mensagens históricas da Evolution API para consultoria_conversas.
 * Busca mensagens do chat de um prospect e insere as que ainda não existem.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const baseUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!baseUrl || !apiKey) throw new Error("Evolution API não configurada");

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id é obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca prospect
    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, responsavel")
      .eq("id", prospect_id)
      .single();
    if (pErr || !prospect) throw new Error("Prospect não encontrado");

    // Resolve instância do usuário
    const { data: inst } = await supabase
      .from("evolution_instances")
      .select("instance_name")
      .eq("created_by", user.id)
      .eq("state", "open")
      .limit(1)
      .maybeSingle();

    if (!inst?.instance_name) {
      throw new Error("Nenhuma instância Evolution conectada para seu usuário.");
    }

    const instanceName = inst.instance_name;
    const phone = prospect.whatsapp.replace(/\D/g, "");
    const remoteJid = `${phone}@s.whatsapp.net`;

    // Busca mensagens da Evolution API
    const chatRes = await fetch(
      `${baseUrl}/chat/findMessages/${instanceName}`,
      {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: 100,
        }),
      }
    );

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error(`[sync] Evolution API error: ${chatRes.status} - ${errText}`);
      throw new Error(`Evolution API retornou ${chatRes.status}`);
    }

    const messages = await chatRes.json();
    if (!Array.isArray(messages)) {
      console.log("[sync] Resposta inesperada:", JSON.stringify(messages).slice(0, 200));
      return new Response(JSON.stringify({ success: true, synced: 0, message: "Sem mensagens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca message_ids já existentes
    const { data: existing } = await supabase
      .from("consultoria_conversas")
      .select("message_id")
      .eq("prospect_id", prospect_id)
      .not("message_id", "is", null);

    const existingIds = new Set((existing ?? []).map(e => e.message_id));

    let synced = 0;
    const toInsert: Array<{
      prospect_id: string;
      direcao: string;
      conteudo: string;
      message_id: string;
      processado_ia: boolean;
      created_at: string;
    }> = [];

    for (const msg of messages) {
      const msgKey = msg.key;
      const msgId = msgKey?.id;
      if (!msgId || existingIds.has(msgId)) continue;

      const isFromMe = msgKey?.fromMe === true;
      const content =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.imageMessage?.caption ??
        null;

      if (!content) continue; // Skip media-only

      const direcao = isFromMe ? "saida" : "entrada";
      const timestamp = msg.messageTimestamp
        ? new Date(
            typeof msg.messageTimestamp === "number"
              ? msg.messageTimestamp * 1000
              : parseInt(msg.messageTimestamp) * 1000
          ).toISOString()
        : new Date().toISOString();

      toInsert.push({
        prospect_id,
        direcao,
        conteudo: content,
        message_id: msgId,
        processado_ia: true,
        created_at: timestamp,
      });
    }

    if (toInsert.length > 0) {
      // Insert em lotes de 50
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error: insErr } = await supabase
          .from("consultoria_conversas")
          .upsert(batch, { onConflict: "message_id", ignoreDuplicates: true });
        if (insErr) console.error("[sync] Insert batch error:", insErr);
        else synced += batch.length;
      }
    }

    console.log(`[sync] ${synced} mensagens sincronizadas para ${prospect.whatsapp}`);

    return new Response(
      JSON.stringify({ success: true, synced, total_found: messages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
