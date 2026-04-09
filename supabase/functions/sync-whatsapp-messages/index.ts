/**
 * Sincroniza mensagens históricas da Evolution API para consultoria_conversas.
 * Busca mensagens do chat de um prospect e insere as que ainda não existem.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ProspectRecord = {
  id: string;
  whatsapp: string;
  responsavel: string | null;
  nicho: string;
};

type SyncInsertRow = {
  prospect_id: string;
  direcao: string;
  conteudo: string;
  message_id: string;
  processado_ia: boolean;
  created_at: string;
};

async function resolveOpenInstancesByUserId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: instances } = await supabase
    .from("evolution_instances")
    .select("instance_name")
    .eq("created_by", userId)
    .eq("state", "open")
    .order("created_at", { ascending: false });

  return (instances ?? []).map((inst) => inst.instance_name as string).filter(Boolean);
}

async function resolveOpenInstancesByResponsavel(supabase: ReturnType<typeof createClient>, responsavel: string) {
  const { data: vsUser } = await supabase
    .from("vs_users")
    .select("id, email")
    .eq("role", responsavel)
    .maybeSingle();

  const resolved = new Set<string>();

  if (vsUser) {
    const directInstances = await resolveOpenInstancesByUserId(supabase, vsUser.id);
    directInstances.forEach((name) => resolved.add(name));

    if (vsUser.email) {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = authData?.users?.find((u: any) => u.email?.toLowerCase() === vsUser.email.toLowerCase());

      if (authUser) {
        const authInstances = await resolveOpenInstancesByUserId(supabase, authUser.id);
        authInstances.forEach((name) => resolved.add(name));
      }
    }
  }

  return Array.from(resolved);
}

function pushUnique(target: string[], values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  }
}

async function resolveCandidateInstances(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  prospect: ProspectRecord,
) {
  const candidates: string[] = [];

  const responsavelInstances = await resolveOpenInstancesByResponsavel(supabase, prospect.responsavel ?? "danilo");
  pushUnique(candidates, responsavelInstances);

  const { data: exactConfig } = await supabase
    .from("consultoria_config")
    .select("instancia_evolution")
    .eq("nicho", prospect.nicho)
    .maybeSingle();
  pushUnique(candidates, [exactConfig?.instancia_evolution]);

  const authUserInstances = await resolveOpenInstancesByUserId(supabase, userId);
  pushUnique(candidates, authUserInstances);

  const { data: allConfigs } = await supabase
    .from("consultoria_config")
    .select("instancia_evolution")
    .order("updated_at", { ascending: false });
  pushUnique(candidates, (allConfigs ?? []).map((config) => config.instancia_evolution as string | null));

  const { data: allOpenInstances } = await supabase
    .from("evolution_instances")
    .select("instance_name")
    .eq("state", "open")
    .order("created_at", { ascending: false });
  pushUnique(candidates, (allOpenInstances ?? []).map((instance) => instance.instance_name as string | null));

  return candidates;
}

function buildRemoteJidCandidates(whatsapp: string) {
  const rawPhone = whatsapp.replace(/\D/g, "");
  const lastDigits = rawPhone.startsWith("55") ? rawPhone.slice(2) : rawPhone;
  const variants = new Set<string>();

  if (rawPhone) variants.add(`${rawPhone}@s.whatsapp.net`);
  if (lastDigits) variants.add(`55${lastDigits}@s.whatsapp.net`);
  if (lastDigits && lastDigits.length >= 10) variants.add(`${lastDigits}@s.whatsapp.net`);

  return Array.from(variants);
}

function extractMessages(rawResult: any): any[] {
  if (Array.isArray(rawResult)) return rawResult;
  if (!rawResult || typeof rawResult !== "object") return [];

  const directCandidates = [rawResult.messages, rawResult.data, rawResult.records, rawResult.result];
  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (rawResult.data && typeof rawResult.data === "object") {
    const nestedCandidates = [rawResult.data.messages, rawResult.data.records, rawResult.data.result];
    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }

  return [];
}

async function fetchMessagesForInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  remoteJids: string[],
) {
  const collected: any[] = [];

  for (const remoteJid of remoteJids) {
    const chatRes = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit: 250,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.warn(`[sync] Evolution API error on ${instanceName} (${remoteJid}): ${chatRes.status} - ${errText}`);
      continue;
    }

    const rawText = await chatRes.text();
    if (!rawText.trim()) continue;

    try {
      const parsed = JSON.parse(rawText);
      const messages = extractMessages(parsed);
      if (messages.length > 0) {
        collected.push(...messages);
      }
    } catch (error) {
      console.warn(`[sync] Não foi possível interpretar resposta da instância ${instanceName}:`, error);
    }
  }

  return collected;
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

    const candidateInstances = await resolveCandidateInstances(supabase, user.id, prospect);
    if (candidateInstances.length === 0) {
      throw new Error("Nenhuma instância Evolution disponível para sincronização.");
    }

    const remoteJids = buildRemoteJidCandidates(prospect.whatsapp);
    const messagesById = new Map<string, any>();
    const matchedInstances: string[] = [];

    for (const instanceName of candidateInstances) {
      const instanceMessages = await fetchMessagesForInstance(baseUrl, apiKey, instanceName, remoteJids);
      if (instanceMessages.length > 0) {
        matchedInstances.push(instanceName);
      }

      for (const message of instanceMessages) {
        const messageId = message?.key?.id;
        if (messageId && !messagesById.has(messageId)) {
          messagesById.set(messageId, message);
        }
      }
    }

    const messages = Array.from(messagesById.values());
    console.log(`[sync] Prospect ${prospect_id}: ${messages.length} mensagens encontradas em ${matchedInstances.join(", ") || "nenhuma instância"}`);

    const { data: existing } = await supabase
      .from("consultoria_conversas")
      .select("message_id")
      .eq("prospect_id", prospect_id)
      .not("message_id", "is", null);

    const existingIds = new Set((existing ?? []).map((e) => e.message_id));

    let synced = 0;
    const toInsert: SyncInsertRow[] = [];

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

    toInsert.sort((a, b) => a.created_at.localeCompare(b.created_at));

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
      JSON.stringify({
        success: true,
        synced,
        total_found: messages.length,
        searched_instances: candidateInstances,
        matched_instances: matchedInstances,
      }),
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