/**
 * Sincroniza mensagens históricas da Evolution API para consultoria_conversas.
 * Usa helper centralizado para resolução de instâncias e normalização de telefone.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildJidCandidates, getAllOpenInstances, resolveSendInstance } from "../_shared/instance-resolver.ts";

function extractMessages(rawResult: any): any[] {
  if (Array.isArray(rawResult)) return rawResult;
  if (!rawResult || typeof rawResult !== "object") return [];
  for (const key of ["messages", "data", "records", "result"]) {
    if (Array.isArray(rawResult[key])) return rawResult[key];
  }
  if (rawResult.data && typeof rawResult.data === "object") {
    for (const key of ["messages", "records", "result"]) {
      if (Array.isArray(rawResult.data[key])) return rawResult.data[key];
    }
  }
  return [];
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
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
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, responsavel, nicho, linked_instance, remote_jid")
      .eq("id", prospect_id).single();
    if (pErr || !prospect) throw new Error("Prospect não encontrado");

    // Build instance candidates: linked first, then all open
    const candidates: string[] = [];
    if (prospect.linked_instance) candidates.push(prospect.linked_instance);
    const allOpen = await getAllOpenInstances(supabase);
    for (const inst of allOpen) {
      if (!candidates.includes(inst)) candidates.push(inst);
    }

    if (candidates.length === 0) {
      throw new Error("Nenhuma instância Evolution disponível para sincronização.");
    }

    // Build JID candidates: use remote_jid if bound, plus phone variations
    const remoteJids: string[] = [];
    if (prospect.remote_jid) remoteJids.push(prospect.remote_jid);
    for (const jid of buildJidCandidates(prospect.whatsapp)) {
      if (!remoteJids.includes(jid)) remoteJids.push(jid);
    }

    const messagesById = new Map<string, any>();
    const matchedInstances: string[] = [];

    for (const instanceName of candidates) {
      for (const remoteJid of remoteJids) {
        try {
          const chatRes = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ where: { key: { remoteJid } }, limit: 250 }),
          });

          if (!chatRes.ok) {
            console.warn(`[sync] ${instanceName}/${remoteJid}: ${chatRes.status}`);
            continue;
          }

          const rawText = await chatRes.text();
          if (!rawText.trim()) continue;

          const parsed = JSON.parse(rawText);
          const messages = extractMessages(parsed);
          if (messages.length > 0) {
            if (!matchedInstances.includes(instanceName)) matchedInstances.push(instanceName);
            for (const msg of messages) {
              const msgId = msg?.key?.id;
              if (msgId && !messagesById.has(msgId)) messagesById.set(msgId, msg);
            }

            // If we found messages, bind the instance
            if (!prospect.linked_instance) {
              await supabase.from("consultoria_prospects").update({
                linked_instance: instanceName, remote_jid: remoteJid,
              }).eq("id", prospect_id);
              prospect.linked_instance = instanceName;
              prospect.remote_jid = remoteJid;
            }
          }
        } catch (e) {
          console.warn(`[sync] Error ${instanceName}/${remoteJid}:`, e);
        }
      }
    }

    const messages = Array.from(messagesById.values());
    console.log(`[sync] Prospect ${prospect_id}: ${messages.length} msgs em ${matchedInstances.join(", ") || "nenhuma"}`);

    // Get existing message_ids
    const { data: existing } = await supabase
      .from("consultoria_conversas").select("message_id")
      .eq("prospect_id", prospect_id).not("message_id", "is", null);
    const existingIds = new Set((existing ?? []).map(e => e.message_id));

    const toInsert: any[] = [];
    for (const msg of messages) {
      const msgId = msg.key?.id;
      if (!msgId || existingIds.has(msgId)) continue;

      const content = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? msg.message?.imageMessage?.caption ?? null;
      if (!content) continue;

      const isFromMe = msg.key?.fromMe === true;
      const rawTs = msg.messageTimestamp;
      const ts = rawTs
        ? new Date((typeof rawTs === "number" ? rawTs : parseInt(rawTs, 10)) * 1000).toISOString()
        : new Date().toISOString();

      toInsert.push({
        prospect_id, direcao: isFromMe ? "saida" : "entrada", conteudo: content,
        message_id: msgId, processado_ia: true, created_at: ts,
        origem: "manual_sync", instance_name: matchedInstances[0] || null,
      });
    }

    toInsert.sort((a, b) => a.created_at.localeCompare(b.created_at));
    let synced = 0;
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
      JSON.stringify({ success: true, synced, total_found: messages.length, searched_instances: candidates, matched_instances: matchedInstances }),
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
