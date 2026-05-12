import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_MAPS_API_KEY =
      Deno.env.get("GOOGLE_MAPS_API_KEY") ??
      Deno.env.get("GOOGLE_API_KEY") ??
      Deno.env.get("GOOGLE_AI_STUDIO") ?? "";

    if (!GOOGLE_MAPS_API_KEY) {
      return json({ error: "GOOGLE_MAPS_API_KEY não configurado. Adicione no Supabase Secrets." }, 400);
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ?? "";

    if (!GOOGLE_API_KEY) {
      return json({ error: "GOOGLE_API_KEY não configurado. Configure a chave Google Maps/Places (não Gemini) nos secrets." }, 400);
    }

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

    // Pre-validate Places API key (fail fast with clear message)
    const probe = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.displayName",
      },
      body: JSON.stringify({ textQuery: "teste", languageCode: "pt-BR", regionCode: "BR", maxResultCount: 1 }),
    }).catch(() => null);
    if (probe && (probe.status === 401 || probe.status === 403)) {
      const errTxt = (await probe.text()).slice(0, 200);
      return json({ error: `GOOGLE_API_KEY inválida ou sem Places API (New) habilitada. Detalhe: ${errTxt}` }, 400);
    }

    // Background dispatch: EdgeRuntime.waitUntil keeps the request alive after we return
    const workerCall = fetch(`${SUPABASE_URL}/functions/v1/scrape-leads-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ niche, locationStr, desiredCount, prospecting_intent, jobId }),
    }).catch(e => console.error("Worker dispatch error:", e));
    // @ts-ignore EdgeRuntime is available at runtime in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(workerCall);
    }

    // Return immediately
    return json({ job_id: jobId, status: "running" });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
