import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type FirecrawlResult = { results: any[]; error?: string; status?: number };

async function firecrawlSearch(apiKey: string, query: string, limit: number): Promise<FirecrawlResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, lang: "pt-br", country: "br", scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { results: data?.data || data?.results || [] };
      }
      const errorText = await resp.text();
      console.error(`Firecrawl search error (${resp.status}) attempt ${attempt}: ${errorText.substring(0, 200)}`);
      if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
        return { results: [], error: `Firecrawl API error ${resp.status}: ${errorText.substring(0, 200)}`, status: resp.status };
      }
      if (resp.status === 429) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
        return { results: [], error: "Firecrawl rate limit (429).", status: 429 };
      }
      if (resp.status >= 500 && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return { results: [], error: `Firecrawl error ${resp.status}`, status: resp.status };
    } catch (e) {
      console.error(`Firecrawl network error attempt ${attempt}:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return { results: [], error: "Firecrawl indisponível" };
}

const CONSULTORIA_VS_CONTEXT = `
EMPRESA: VS Growth Hub — Consultoria de Crescimento para negócios locais.
Nichos: Estética, Odonto, Advocacia, Revendas de Veículos Seminovos.
ICP: Donos de negócios locais, faturamento >R$30k/mês, equipe >=3, investem em marketing.
Score ICP 80-100=perfeito, 60-79=bom, 40-59=médio, 20-39=fraco, 0-19=ruim.
`.trim();

function buildSmartQueries(niche: string, locationStr: string, intent: string): string[] {
  const loc = locationStr || "";
  const city = loc.split(",")[0]?.trim() || "";
  const nicheLower = niche.toLowerCase();

  if (nicheLower.includes("revenda") || nicheLower.includes("veículo") || nicheLower.includes("seminovo") || nicheLower.includes("carro")) {
    const queries = [
      `revenda seminovos ${city} telefone WhatsApp`,
      `loja de carros usados ${city} contato`,
      `multimarcas ${city} seminovos WhatsApp`,
    ];
    if (intent?.trim()) queries.push(`revenda veículos ${loc} ${intent.trim().slice(0, 60)}`);
    return queries.slice(0, 3);
  }

  const queries = [
    `${niche} ${loc} telefone contato`,
    `${niche} ${loc} WhatsApp celular`,
    `"${niche}" "${city}" site contato`,
  ];
  if (intent?.trim()) queries[2] = `${niche} ${loc} ${intent.trim().slice(0, 60)}`;
  return queries.slice(0, 3);
}

// ── Background processing ──
async function processInBackground(params: {
  niche: string; locationStr: string; desiredCount: number;
  prospecting_intent: string; jobId: string;
  FIRECRAWL_API_KEY: string; SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string;
}) {
  const { niche, locationStr, desiredCount, prospecting_intent, jobId,
    FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = params;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // PHASE 1: Search
    const queries = buildSmartQueries(niche, locationStr, prospecting_intent);
    const perQueryLimit = Math.ceil(desiredCount / 2);
    console.log(`[${jobId}] Running ${queries.length} queries (${perQueryLimit} each)...`);

    const allResults: any[] = [];
    const seenUrls = new Set<string>();
    let firecrawlError: string | null = null;

    // Run queries sequentially to reduce memory
    for (const q of queries) {
      const result = await firecrawlSearch(FIRECRAWL_API_KEY, q, perQueryLimit);
      if (result.error && !firecrawlError) firecrawlError = result.error;
      for (const r of result.results) {
        const url = r.url || r.metadata?.sourceURL || "";
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          allResults.push(r);
        }
      }
    }

    console.log(`[${jobId}] ${allResults.length} unique pages found`);

    if (allResults.length === 0) {
      await supabaseAdmin.from("leads_raw").update({
        enrichment_data: { job_id: jobId, status: "completed", count: 0, error: firecrawlError || "Nenhum resultado" }
      }).eq("id", jobId);
      return;
    }

    // PHASE 2: Build context (trimmed to 2000 chars per page, max 15 pages)
    const pagesForAI = allResults.slice(0, 15);
    const pagesContent = pagesForAI.map((r: any, i: number) => {
      const title = r.title || r.metadata?.title || `Resultado ${i + 1}`;
      const url = r.url || r.metadata?.sourceURL || "";
      const markdown = (r.markdown || r.content || "").substring(0, 2000);
      return `--- PÁG ${i + 1}: ${title} (${url}) ---\n${markdown}`;
    }).join("\n\n");

    // PHASE 3: AI extraction
    const extractionPrompt = `Extraia TODOS os contatos de empresas "${niche}" ${locationStr ? `em ${locationStr}` : ""} das páginas abaixo.
${prospecting_intent ? `\nIntenção: "${prospecting_intent}"\n` : ""}
${pagesContent}

${CONSULTORIA_VS_CONTEXT}

Responda APENAS JSON: {"contacts":[{"name":"str|null","phone":"str|null","email":"str|null","company":"str|null","role":"str|null","city":"str|null","website":"str|null","segment":"str|null","company_size":"str|null","icp_score":0,"icp_reason":"str|null"}]}`;

    console.log(`[${jobId}] Sending ${pagesForAI.length} pages to AI...`);

    let aiContent = "";
    const { callClaude } = await import("../_shared/ai-client.ts");
    const aiResult = await callClaude({
      system: `Extraia contatos B2B e qualifique com ICP score. Retorne APENAS JSON válido.`,
      messages: [{ role: "user", content: extractionPrompt }],
      max_tokens: 4096,
    });
    aiContent = aiResult.text ?? "";

    let contacts: any[] = [];
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) contacts = JSON.parse(jsonMatch[0]).contacts || [];
    } catch {
      const contactMatches = aiContent.matchAll(/\{\s*"name"\s*:\s*(?:"[^"]*"|null)[\s\S]*?"icp_score"\s*:\s*\d+[\s\S]*?\}/g);
      for (const m of contactMatches) {
        try { contacts.push(JSON.parse(m[0])); } catch {}
      }
    }

    console.log(`[${jobId}] AI extracted ${contacts.length} contacts`);

    // PHASE 4: Format, deduplicate, save
    const formatPhone = (phone: string): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return null;
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      return null;
    };

    const capitalizeName = (name: string): string | null =>
      name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueContacts = contacts.filter((c: any) => {
      const phone = formatPhone(c.phone || "");
      const email = c.email?.toLowerCase()?.trim();
      if (phone && seenPhones.has(phone)) return false;
      if (!phone && email && seenEmails.has(email)) return false;
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      return phone || email;
    });

    uniqueContacts.sort((a: any, b: any) => (b.icp_score || 50) - (a.icp_score || 50));

    // Check DB duplicates
    const phonesToCheck = uniqueContacts.map((c: any) => formatPhone(c.phone || "")).filter(Boolean) as string[];
    const existingPhones = new Set<string>();

    if (phonesToCheck.length > 0) {
      const [{ data: rawByPhone }, { data: prospectByPhone }] = await Promise.all([
        supabaseAdmin.from("leads_raw").select("phone").in("phone", phonesToCheck),
        supabaseAdmin.from("consultoria_prospects").select("whatsapp").in("whatsapp", phonesToCheck),
      ]);
      (rawByPhone || []).forEach((l: any) => existingPhones.add(l.phone));
      (prospectByPhone || []).forEach((l: any) => existingPhones.add(l.whatsapp));
    }

    const emailsToCheck = uniqueContacts.map((c: any) => c.email?.toLowerCase()?.trim()).filter(Boolean) as string[];
    const existingEmails = new Set<string>();
    if (emailsToCheck.length > 0) {
      const { data: existingByEmail } = await supabaseAdmin.from("leads_raw").select("email").in("email", emailsToCheck);
      existingEmails = new Set((existingByEmail || []).map((l: any) => l.email?.toLowerCase()));
    }

    const newLeads = uniqueContacts
      .map((c: any) => {
        const phone = formatPhone(c.phone || "");
        const email = c.email?.toLowerCase()?.trim() || null;
        const icpScore = typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50;
        if (phone && existingPhones.has(phone)) return null;
        if (!phone && email && existingEmails.has(email)) return null;
        return {
          name: capitalizeName(c.name || c.company || "") || "Lead sem nome",
          phone, email,
          source: "web" as const,
          status: "pending" as const,
          tags: [`job:${jobId}`],
          enrichment_data: {
            company: c.company || null, role: c.role || null, city: c.city || null,
            website: c.website || null, segment: c.segment || niche,
            company_size: c.company_size || null,
            scraped_niche: niche, scraped_location: locationStr,
            scraped_at: new Date().toISOString(),
            prospecting_intent: prospecting_intent || null,
            icp_score: icpScore, icp_reason: c.icp_reason || null,
            job_id: jobId,
          },
        };
      })
      .filter(Boolean);

    let savedCount = 0;
    if (newLeads.length > 0) {
      for (let i = 0; i < newLeads.length; i += 50) {
        const chunk = newLeads.slice(i, i + 50);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(chunk);
        if (insertError) console.error("Insert error:", insertError);
        else savedCount += chunk.length;
      }
    }

    // Insert a sentinel row to signal completion
    await supabaseAdmin.from("leads_raw").insert({
      name: `__job_complete__`,
      source: "system",
      status: "job_complete",
      tags: [`job:${jobId}`],
      enrichment_data: {
        job_id: jobId, status: "completed",
        count: savedCount, total_found: contacts.length,
        duplicates_skipped: contacts.length - newLeads.length,
        pages_searched: allResults.length,
        avg_icp_score: uniqueContacts.length
          ? Math.round(uniqueContacts.reduce((s: number, c: any) => s + (c.icp_score || 50), 0) / uniqueContacts.length)
          : 0,
        results: uniqueContacts.slice(0, 50).map((c: any) => ({
          name: capitalizeName(c.name || c.company || "") || null,
          phone: formatPhone(c.phone || ""), email: c.email || null,
          company: c.company || null, city: c.city || null,
          website: c.website || null, segment: c.segment || null,
          icp_score: typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50,
          icp_reason: c.icp_reason || null,
        })),
      },
    });

    console.log(`[${jobId}] DONE: ${savedCount} saved, ${contacts.length - newLeads.length} dupes`);
  } catch (e) {
    console.error(`[${jobId}] Background error:`, e);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabaseAdmin.from("leads_raw").insert({
      name: `__job_complete__`,
      source: "system",
      status: "job_failed",
      tags: [`job:${jobId}`],
      enrichment_data: {
        job_id: jobId, status: "failed",
        error: e instanceof Error ? e.message : "Unknown error",
      },
    });
  }
}

Deno.serve(async (req) => {
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!FIRECRAWL_API_KEY) return json({ error: "Firecrawl não configurado." }, 400);

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
        .eq("status", "job_complete").or(`status.eq.job_failed`)
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

    const locationParts: string[] = [];
    if (bairro) locationParts.push(bairro);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(", ");
    const desiredCount = Math.min(Math.max(limit, 5), 50);

    const jobId = crypto.randomUUID();
    console.log(`[${jobId}] Starting background prospecting: "${niche}" in "${locationStr}" (${desiredCount} leads)`);

    // Start background processing
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processInBackground({
        niche, locationStr, desiredCount, prospecting_intent, jobId,
        FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      })
    ) ?? processInBackground({
      niche, locationStr, desiredCount, prospecting_intent, jobId,
      FIRECRAWL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    });

    // Return immediately
    return json({ job_id: jobId, status: "running" });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
