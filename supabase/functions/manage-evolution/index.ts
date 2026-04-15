import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const baseUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (!baseUrl || !apiKey) return json({ error: "Evolution API não configurada." }, 500);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, instance_name } = body;

    // CREATE
    if (action === "create") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);
      const response = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: instance_name, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return json({ error: `Erro ao criar instância: ${response.status} - ${errText}` }, 502);
      }
      const data = await response.json();
      await supabaseAdmin.from("evolution_instances").upsert(
        { instance_name, created_by: user.id, state: "created" },
        { onConflict: "instance_name" }
      );

      // Auto-configure webhook
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      try {
        await fetch(`${baseUrl}/webhook/set/${instance_name}`, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook: { url: webhookUrl, enabled: true, webhook_by_events: false, webhook_base64: false, events: ["MESSAGES_UPSERT"] },
          }),
        });
      } catch (e) { console.error(`Failed to set webhook for ${instance_name}:`, e); }

      return json({ instance: data.instance, qrcode: data.qrcode, hash: data.hash });
    }

    // QRCODE
    if (action === "qrcode") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);
      const response = await fetch(`${baseUrl}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });
      if (!response.ok) return json({ error: `Erro ao obter QR code: ${response.status}` }, 502);
      const data = await response.json();
      return json({ qrcode: data.base64 || data.qrcode, code: data.code });
    }

    // STATUS
    if (action === "status") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);
      const response = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
        method: "GET",
        headers: { apikey: apiKey },
      });
      if (!response.ok) return json({ state: "unknown" });
      const data = await response.json();
      const state = data.instance?.state || data.state || "unknown";
      if (state === "open") {
        await supabaseAdmin.from("evolution_instances").update({ state: "open" }).eq("instance_name", instance_name);
      }
      return json({ state });
    }

    // LIST
    if (action === "list") {
      const { data: dbInstances } = await supabaseAdmin.from("evolution_instances").select("instance_name").order("created_at");
      const names = (dbInstances || []).map((i: any) => i.instance_name);

      const instances = await Promise.all(names.map(async (name: string) => {
        try {
          const resp = await fetch(`${baseUrl}/instance/connectionState/${name}`, {
            method: "GET",
            headers: { apikey: apiKey },
          });
          if (!resp.ok) return { name, state: "unknown", owner: null };
          const data = await resp.json();
          return { name, state: data.instance?.state || data.state || "unknown", owner: null };
        } catch { return { name, state: "unknown", owner: null }; }
      }));

      return json({ instances });
    }

    // DELETE
    if (action === "delete") {
      if (!instance_name) return json({ error: "instance_name is required" }, 400);
      const response = await fetch(`${baseUrl}/instance/delete/${instance_name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });
      if (!response.ok && response.status !== 404) {
        const errText = await response.text();
        return json({ error: `Erro ao deletar: ${response.status} - ${errText}` }, 502);
      }
      await supabaseAdmin.from("evolution_instances").delete().eq("instance_name", instance_name);
      return json({ success: true });
    }

    // RECONFIGURE WEBHOOKS
    if (action === "reconfigure_webhooks") {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      const { data: dbInstances } = await supabaseAdmin.from("evolution_instances").select("instance_name").order("created_at");
      const names = (dbInstances || []).map((i: any) => i.instance_name);
      const results: any[] = [];

      for (const name of names) {
        try {
          const resp = await fetch(`${baseUrl}/webhook/set/${name}`, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              webhook: { url: webhookUrl, enabled: true, webhook_by_events: false, webhook_base64: false, events: ["MESSAGES_UPSERT"] },
            }),
          });
          results.push({ name, success: resp.ok, status: resp.status });
        } catch (e) {
          results.push({ name, success: false, error: (e as Error).message });
        }
      }

      return json({ success: true, webhook_url: webhookUrl, results });
    }

    return json({ error: `Ação inválida: ${action}` }, 400);
  } catch (e) {
    console.error("manage-evolution error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
