/**
 * Sincroniza mensagens históricas da Evolution API para consultoria_conversas.
 * Busca mensagens do chat de um prospect e insere as que ainda não existem.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function resolveInstanceByUserId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: inst } = await supabase
    .from("evolution_instances")
    .select("instance_name")
    .eq("created_by", userId)
    .eq("state", "open")
    .limit(1)
    .maybeSingle();

  return (inst?.instance_name as string | undefined) ?? null;
}

async function resolveInstanceByResponsavel(supabase: ReturnType<typeof createClient>, responsavel: string) {
  const { data: vsUser } = await supabase
    .from("vs_users")
    .select("id, email")
    .eq("role", responsavel)
    .maybeSingle();

  if (vsUser) {
    const { data: inst } = await supabase
      .from("evolution_instances")
      .select("instance_name")
      .eq("created_by", vsUser.id)
      .eq("state", "open")
      .limit(1)
      .maybeSingle();

    if (inst) return inst.instance_name as string;

    if (vsUser.email) {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = authData?.users?.find((u: any) => u.email?.toLowerCase() === vsUser.email.toLowerCase());

      if (authUser) {
        const { data: inst2 } = await supabase
          .from("evolution_instances")
          .select("instance_name")
          .eq("created_by", authUser.id)
          .eq("state", "open")
          .limit(1)
          .maybeSingle();

        if (inst2) return inst2.instance_name as string;
      }
    }
  }

  return null;
}

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id é obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, responsavel, nicho")
      .eq("id", prospect_id)
      .single();
    if (pErr || !prospect) throw new Error("Prospect não encontrado");

    let instanceName = await resolveInstanceByUserId(supabase, user.id);

    if (!instanceName) {
      instanceName = await resolveInstanceByResponsavel(supabase, prospect.responsavel ?? "danilo");
    }

    if (!instanceName) {
      const { data: exactConfig } = await supabase
        .from("consultoria_config")
        .select("instancia_evolution")
        .eq("nicho", prospect.nicho)
        .maybeSingle();

      if (exactConfig?.instancia_evolution) {
        instanceName = exactConfig.instancia_evolution;
      } else {
        const { data: allConfigs } = await supabase
          .from("consultoria_config")
          .select("instancia_evolution");
        instanceName = allConfigs?.find((c: any) => c.instancia_evolution)?.instancia_evolution ?? null;
      }
    }

    if (!instanceName) {
      throw new Error("Nenhuma instância Evolution disponível para sincronização.");
    }

    const rawPhone = prospect.whatsapp.replace(/\D/g, "");
    const normalizedPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
    const remoteJid = `${normalizedPhone}@s.whatsapp.net`;

    const chatRes = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit: 100,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error(`[sync] Evolution API error: ${chatRes.status} - ${errText}`);
      throw new Error(`Evolution API retornou ${chatRes.status}`);
    }

    const rawResult = await chatRes.json();
    const messages = Array.isArray(rawResult)
      ? rawResult
      : Array.isArray(rawResult?.messages)
        ? rawResult.messages
        : Array.isArray(rawResult?.data)
          ? rawResult.data
          : [];

    const { data: existing } = await supabase
      .from("consultoria_conversas")
      .select("message_id")
      .eq("prospect_id", prospect_id)
      .not("message_id", "is", null);

    const existingIds = new Set((existing ?? []).map((e) => e.message_id));

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

      const content =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.imageMessage?.caption ??
        null;

      if (!content) continue;

      const isFromMe = msgKey?.fromMe === true;
      const rawTimestamp = msg.messageTimestamp;
      const timestamp = rawTimestamp
        ? new Date((typeof rawTimestamp === "number" ? rawTimestamp : parseInt(rawTimestamp, 10)) * 1000).toISOString()
        : new Date().toISOString();

      toInsert.push({
        prospect_id,
        direcao: isFromMe ? "saida" : "entrada",
        conteudo: content,
        message_id: msgId,
        processado_ia: true,
        created_at: timestamp,
      });
    }

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error: insErr } = await supabase
          .from("consultoria_conversas")
          .upsert(batch, { onConflict: "message_id", ignoreDuplicates: true });
        if (insErr) throw insErr;
        synced += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced, total_found: messages.length, instance_name: instanceName }),
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