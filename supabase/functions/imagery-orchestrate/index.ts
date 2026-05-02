// Imagery Engine — Orchestrator (Onda 1: stub)
// Recebe { post_id } → roda generate-image em todos os slides com needs_image em paralelo.
// Onda 2 acrescentará: validate → retry → compose.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callFn(name: string, body: unknown, authHeader: string) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: resp.ok, status: resp.status, json, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("imagery_posts").update({ status: "generating" }).eq("id", post_id);

    const { data: slides, error } = await admin.from("imagery_slides")
      .select("id, needs_image").eq("post_id", post_id).order("slide_n");
    if (error) throw error;

    const targets = (slides ?? []).filter((s) => s.needs_image);
    const results = await Promise.allSettled(
      targets.map((s) => callFn("imagery-generate-image", { slide_id: s.id }, authHeader))
    );

    const ok = results.filter((r) => r.status === "fulfilled" && (r as any).value.ok).length;
    const failed = results.length - ok;

    // Total cost
    const { data: logs } = await admin.from("imagery_logs")
      .select("custo_usd").eq("post_id", post_id);
    const total = (logs ?? []).reduce((acc: number, l: any) => acc + Number(l.custo_usd ?? 0), 0);

    await admin.from("imagery_posts").update({
      status: failed === 0 ? "ready" : "failed",
      error_message: failed > 0 ? `${failed}/${results.length} slides falharam` : null,
      custo_total_usd: total,
    }).eq("id", post_id);

    return new Response(JSON.stringify({
      post_id, total_slides: targets.length, ok, failed, custo_total_usd: total,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("imagery-orchestrate error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});