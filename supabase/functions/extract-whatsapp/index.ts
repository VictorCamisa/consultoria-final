import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const formatPhone = (jid: string) => {
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { mode = "group", group_ids, instance_name, tags } = body;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    if (!apiKey || !evolutionUrl) return json({ error: "Evolution API não configurada." }, 500);

    const baseUrl = evolutionUrl.replace(/\/$/, "");
    const instance = instance_name || "default";

    // Verify instance connected
    try {
      const stateResp = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        method: "GET", headers: { apikey: apiKey },
      });
      if (!stateResp.ok) return json({ error: `Instância "${instance}" não encontrada.` }, 400);
      const stateData = await stateResp.json();
      const connState = stateData?.instance?.state || stateData?.state;
      if (connState !== "open") return json({ error: `Instância "${instance}" não conectada (${connState}).` }, 400);
    } catch (e) {
      return json({ error: `Erro ao verificar instância "${instance}".` }, 500);
    }

    // LIST_GROUPS
    if (mode === "list_groups") {
      const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}?getParticipants=false`, {
        method: "GET", headers: { apikey: apiKey },
      });
      if (!groupsResponse.ok) return json({ error: `Erro ao buscar grupos (${groupsResponse.status}).` }, 400);
      const groups = await groupsResponse.json();
      const groupList = (Array.isArray(groups) ? groups : []).map((g: any) => ({
        id: g.id, name: g.subject || g.name || "Sem nome", size: g.size || g.participants?.length || 0,
      }));
      return json({ groups: groupList });
    }

    // GROUP - Extract participants
    if (mode === "group") {
      if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0)
        return json({ error: "group_ids (array) is required" }, 400);

      const groupsResponse = await fetch(`${baseUrl}/group/fetchAllGroups/${instance}`, {
        method: "GET", headers: { apikey: apiKey },
      });
      if (!groupsResponse.ok) return json({ error: `Erro ao buscar grupos: ${groupsResponse.status}` }, 502);
      const allGroups = await groupsResponse.json();
      const groupsArr = Array.isArray(allGroups) ? allGroups : [];

      let totalNew = 0;
      const groupNames: string[] = [];

      for (const groupId of group_ids) {
        const targetGroup = groupsArr.find((g: any) => g.id === groupId);
        const groupName = targetGroup?.subject || groupId;
        groupNames.push(groupName);

        const participantsResponse = await fetch(`${baseUrl}/group/participants/${instance}?groupJid=${groupId}`, {
          method: "GET", headers: { apikey: apiKey },
        });
        if (!participantsResponse.ok) continue;

        const participantsData = await participantsResponse.json();
        const participants = participantsData?.participants || participantsData || [];
        if (!Array.isArray(participants)) continue;

        const phones = participants.map((p: any) => formatPhone(p.id || "")).filter(Boolean);
        const { data: existingLeads } = await supabaseAdmin
          .from("leads_raw").select("phone").in("phone", phones);
        const existingPhones = new Set((existingLeads || []).map((l: any) => l.phone));

        const newLeads = participants.map((p: any) => {
          const ph = formatPhone(p.id || "");
          if (!ph || existingPhones.has(ph)) return null;
          return {
            name: p.name || p.notify || null,
            phone: ph,
            source: "whatsapp",
            status: "pending",
            tags: Array.isArray(tags) && tags.length > 0 ? tags : [],
            enrichment_data: { group: groupName, group_id: groupId, extraction_type: "group" },
          };
        }).filter(Boolean);

        if (newLeads.length > 0) {
          const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(newLeads);
          if (!insertError) totalNew += newLeads.length;
        }
      }
      return json({ count: totalNew, groups: groupNames });
    }

    // CONVERSATION
    if (mode === "conversation") {
      const contactsResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST", headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });
      if (!contactsResponse.ok) return json({ error: `Erro ao buscar conversas: ${contactsResponse.status}` }, 502);

      const contactsData = await contactsResponse.json();
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || contactsData?.contacts || [];
      const individualContacts = contacts.filter((c: any) => {
        const jid = c.remoteJid || c.jid || "";
        return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("0@") && !jid.startsWith("status@");
      });

      const phones = individualContacts.map((c: any) => formatPhone(c.remoteJid || c.jid || "")).filter(Boolean);
      let allExistingPhones = new Set<string | null>();
      for (let i = 0; i < phones.length; i += 500) {
        const batch = phones.slice(i, i + 500);
        const { data: existing } = await supabaseAdmin.from("leads_raw").select("phone").in("phone", batch);
        (existing || []).forEach((l: any) => allExistingPhones.add(l.phone));
      }

      const newLeads = individualContacts.map((c: any) => {
        const ph = formatPhone(c.remoteJid || c.jid || "");
        if (!ph || allExistingPhones.has(ph)) return null;
        return { name: c.pushName || c.name || c.verifiedName || null, phone: ph, source: "whatsapp", status: "pending", enrichment_data: { extraction_type: "conversation" } };
      }).filter(Boolean);

      let insertedCount = 0;
      for (let i = 0; i < newLeads.length; i += 500) {
        const batch = newLeads.slice(i, i + 500);
        const { error } = await supabaseAdmin.from("leads_raw").insert(batch);
        if (!error) insertedCount += batch.length;
      }
      return json({ count: insertedCount, total_conversations: individualContacts.length });
    }

    // CONTACT
    if (mode === "contact") {
      const contactsResponse = await fetch(`${baseUrl}/chat/findContacts/${instance}`, {
        method: "POST", headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: {} }),
      });
      if (!contactsResponse.ok) return json({ error: `Erro ao buscar contatos: ${contactsResponse.status}` }, 502);

      const contactsData = await contactsResponse.json();
      const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || contactsData?.contacts || [];
      const savedContacts = contacts.filter((c: any) => {
        const jid = c.remoteJid || c.jid || "";
        const hasName = c.pushName || c.name || c.verifiedName;
        return jid.endsWith("@s.whatsapp.net") && !jid.startsWith("0@") && !jid.startsWith("status@") && hasName;
      });

      const phones = savedContacts.map((c: any) => formatPhone(c.remoteJid || c.jid || "")).filter(Boolean);
      let allExistingPhones = new Set<string | null>();
      for (let i = 0; i < phones.length; i += 500) {
        const batch = phones.slice(i, i + 500);
        const { data: existing } = await supabaseAdmin.from("leads_raw").select("phone").in("phone", batch);
        (existing || []).forEach((l: any) => allExistingPhones.add(l.phone));
      }

      const newLeads = savedContacts.map((c: any) => {
        const ph = formatPhone(c.remoteJid || c.jid || "");
        if (!ph || allExistingPhones.has(ph)) return null;
        return { name: c.pushName || c.name || c.verifiedName || null, phone: ph, source: "whatsapp", status: "pending", enrichment_data: { extraction_type: "contact" } };
      }).filter(Boolean);

      let insertedCount = 0;
      for (let i = 0; i < newLeads.length; i += 500) {
        const batch = newLeads.slice(i, i + 500);
        const { error } = await supabaseAdmin.from("leads_raw").insert(batch);
        if (!error) insertedCount += batch.length;
      }
      return json({ count: insertedCount, total_contacts: savedContacts.length });
    }

    return json({ error: `Modo inválido: ${mode}` }, 400);
  } catch (e) {
    console.error("extract-whatsapp error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
