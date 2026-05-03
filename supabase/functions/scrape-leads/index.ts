import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");

    if (!SERPER_API_KEY) return json({ error: "SERPER_API_KEY não configurado." }, 400);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { niche, city, state, bairro, limit = 20, prospecting_intent = "" } = body;
    if (!niche) return json({ error: "niche é obrigatório" }, 400);

    // Check for polling request
    if (body.poll_job_id) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: sentinel } = await supabaseAdmin.from("leads_raw")
        .select("enrichment_data")
        .or("status.eq.job_complete,status.eq.job_failed")
        .contains("tags", [`job:${body.poll_job_id}`])
        .limit(1)
        .maybeSingle();

      if (sentinel) {
        const ed = sentinel.enrichment_data as any;
        // Clean up sentinel
        await supabaseAdmin.from("leads_raw").delete()
          .eq("name", "__job_complete__")
          .contains("tags", [`job:${body.poll_job_id}`]);

        if (ed?.status === "failed") {
          return json({ status: "failed", error: ed.error || "Erro desconhecido" });
        }
        return json({
          status: "completed",
          count: ed.count || 0,
          total_found: ed.total_found || 0,
          duplicates_skipped: ed.duplicates_skipped || 0,
          pages_searched: ed.pages_searched || 0,
          avg_icp_score: ed.avg_icp_score || 0,
          results: ed.results || [],
        });
      }
      return json({ status: "running" });
    }

    // Build location string
    const locationParts: string[] = [];
    if (bairro) locationParts.push(bairro);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(", ");
    const desiredCount = Math.min(Math.max(limit, 5), 50);

    const jobId = crypto.randomUUID();
    console.log(`[${jobId}] Dispatching to worker: "${niche}" in "${locationStr}" (${desiredCount} leads)`);

    // Fire-and-forget: call worker without await
    fetch(`${SUPABASE_URL}/functions/v1/scrape-leads-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ niche, locationStr, desiredCount, prospecting_intent, jobId }),
    }).catch(e => console.error("Worker dispatch error:", e));

    // Return immediately
    return json({ job_id: jobId, status: "running" });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
