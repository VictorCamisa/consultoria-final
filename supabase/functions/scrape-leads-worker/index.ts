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
ICP: Donos de negócios locais, faturamento >R$30k/mês, equipe >=3, investem em marketing.
Score ICP 80-100=perfeito, 60-79=bom, 40-59=médio, 20-39=fraco, 0-19=ruim.
`.trim();

function buildSmartQueries(niche: string, locationStr: string, intent: string): string[] {
  const loc = locationStr || "";
  const city = loc.split(",")[0]?.trim() || "";
  const nicheLower = niche.toLowerCase();

  if (nicheLower.includes("revenda") || nicheLower.includes("veículo") || nicheLower.includes("seminovo") || nicheLower.includes("carro") || nicheLower.includes("auto")) {
    const queries = [
      `revenda seminovos ${city} WhatsApp telefone`,
      `loja carros usados ${city} contato celular`,
      `multimarcas ${city} veículos seminovos endereço`,
      `compra venda veículos ${city} WhatsApp celular`,
      `seminovos ${loc} telefone site`,
      `"revenda" "${city}" veículos fone contato`,
      `automoveis seminovos ${city} celular endereço`,
    ];
    if (intent?.trim()) queries.push(`${city} veículos seminovos ${intent.trim().slice(0, 80)}`);
    return queries.slice(0, 8);
  }

  if (nicheLower.includes("estética") || nicheLower.includes("estetic") || nicheLower.includes("bem-estar") || nicheLower.includes("depilação") || nicheLower.includes("skincare")) {
    const queries = [
      `clínica estética ${city} WhatsApp telefone`,
      `estética ${city} agendamento contato celular`,
      `salão estética ${city} telefone endereço`,
      `clínica depilação ${city} WhatsApp contato`,
      `estética dermato ${city} celular site`,
      `"estética" "${city}" fone agendamento`,
      `clínica beleza ${city} contato WhatsApp`,
    ];
    if (intent?.trim()) queries.push(`${city} estética ${intent.trim().slice(0, 80)}`);
    return queries.slice(0, 8);
  }

  if (nicheLower.includes("odonto") || nicheLower.includes("dentist") || nicheLower.includes("clínica odontológ")) {
    const queries = [
      `clínica odontológica ${city} WhatsApp telefone`,
      `dentista ${city} contato celular endereço`,
      `odontologia ${city} agendamento site`,
      `clínica dental ${city} WhatsApp`,
      `"odontológica" "${city}" fone contato`,
    ];
    if (intent?.trim()) queries.push(`${city} odontologia ${intent.trim().slice(0, 80)}`);
    return queries.slice(0, 6);
  }

  if (nicheLower.includes("advoca") || nicheLower.includes("jurídic") || nicheLower.includes("direito")) {
    const queries = [
      `escritório advocacia ${city} WhatsApp telefone`,
      `advogado ${city} contato celular`,
      `advogados ${city} site endereço`,
      `"advocacia" "${city}" fone`,
      `direito ${city} escritório contato`,
    ];
    if (intent?.trim()) queries.push(`${city} advocacia ${intent.trim().slice(0, 80)}`);
    return queries.slice(0, 6);
  }

  // Generic niche: 6 diverse queries to maximize coverage
  const queries = [
    `${niche} ${loc} telefone contato`,
    `${niche} ${loc} WhatsApp celular`,
    `"${niche}" "${city}" endereço telefone`,
    `${niche} ${city} site contato`,
    `${niche} perto de ${city} celular WhatsApp`,
    `${niche} ${loc} fone endereço site`,
  ];
  if (intent?.trim()) queries[5] = `${niche} ${loc} ${intent.trim().slice(0, 80)}`;
  return queries.slice(0, 6);
}

/** Split pages into batches and call AI for each batch, then merge contacts */
async function extractContactsBatch(
  pages: any[],
  niche: string,
  locationStr: string,
  prospecting_intent: string,
  jobId: string,
): Promise<any[]> {
  const { callClaude } = await import("../_shared/ai-client.ts");

  // Process in batches of 8 pages to stay within token limits but cover more
  const BATCH_SIZE = 8;
  const allContacts: any[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const pagesContent = batch.map((r: any, idx: number) => {
      const title = r.title || r.metadata?.title || `Resultado ${idx + 1}`;
      const url = r.url || r.metadata?.sourceURL || "";
      const markdown = (r.markdown || r.content || "").substring(0, 2500);
      return `--- PÁG ${idx + 1}: ${title} (${url}) ---\n${markdown}`;
    }).join("\n\n");

    const extractionPrompt = `Extraia TODOS os contatos de empresas "${niche}" ${locationStr ? `em ${locationStr}` : ""} das páginas abaixo.
${prospecting_intent ? `\nIntenção: "${prospecting_intent}"\n` : ""}
${pagesContent}

${CONSULTORIA_VS_CONTEXT}

IMPORTANTE: Extraia TODOS os telefones/contatos que encontrar, mesmo que pareçam incompletos. Cada empresa deve ser um contato separado.

Responda APENAS JSON: {"contacts":[{"name":"str|null","phone":"str|null","email":"str|null","company":"str|null","role":"str|null","city":"str|null","website":"str|null","segment":"str|null","company_size":"str|null","icp_score":0,"icp_reason":"str|null"}]}`;

    console.log(`[${jobId}] AI batch ${batchNum}: ${batch.length} pages...`);

    try {
      const aiResult = await callClaude({
        system: `Extraia o MÁXIMO de contatos B2B possível. Cada empresa com telefone ou email deve ser um contato separado. Retorne APENAS JSON válido.`,
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 4096,
      });
      const aiContent = aiResult.text ?? "";

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

      console.log(`[${jobId}] AI batch ${batchNum}: extracted ${contacts.length} contacts`);
      allContacts.push(...contacts);
    } catch (e) {
      console.error(`[${jobId}] AI batch ${batchNum} error:`, e);
    }
  }

  return allContacts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { niche, locationStr, desiredCount, prospecting_intent, jobId } = await req.json();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[${jobId}] Worker started: "${niche}" in "${locationStr}" (${desiredCount} leads)`);

    // PHASE 1: Search — each query gets a fixed minimum so total coverage
    // isn't penalized by having more queries. perQueryLimit is at least 15
    // regardless of query count so a wider query set doesn't shrink each search.
    const queries = buildSmartQueries(niche, locationStr, prospecting_intent);
    const perQueryLimit = Math.max(Math.ceil(desiredCount * 1.5 / queries.length), 15);

    const allResults: any[] = [];
    const seenUrls = new Set<string>();
    let firecrawlError: string | null = null;

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
      await supabaseAdmin.from("leads_raw").insert({
        name: `__job_complete__`, source: "system", status: "job_complete",
        tags: [`job:${jobId}`],
        enrichment_data: { job_id: jobId, status: "completed", count: 0, error: firecrawlError || "Nenhum resultado" },
      });
      return new Response(JSON.stringify({ status: "completed", count: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PHASE 2: Send pages to AI in batches — raised cap to 80 to handle
    // larger result sets from the expanded query list
    const maxPages = Math.min(allResults.length, 80);
    const pagesForAI = allResults.slice(0, maxPages);

    console.log(`[${jobId}] Sending ${pagesForAI.length} pages to AI in batches...`);

    const contacts = await extractContactsBatch(pagesForAI, niche, locationStr, prospecting_intent, jobId);

    console.log(`[${jobId}] Total AI extracted: ${contacts.length} contacts`);

    // PHASE 3: Format, deduplicate, save
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
    let existingEmails = new Set<string>();
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

    // Insert sentinel row to signal completion
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
        results: uniqueContacts.slice(0, 100).map((c: any) => ({
          name: capitalizeName(c.name || c.company || "") || null,
          phone: formatPhone(c.phone || ""), email: c.email || null,
          company: c.company || null, city: c.city || null,
          website: c.website || null, segment: c.segment || null,
          icp_score: typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50,
          icp_reason: c.icp_reason || null,
        })),
      },
    });

    console.log(`[${jobId}] DONE: ${savedCount} saved, ${contacts.length - newLeads.length} dupes, ${allResults.length} pages searched`);

    return new Response(JSON.stringify({ status: "completed", count: savedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Worker error:", e);
    try {
      const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body = await req.clone().json().catch(() => ({}));
      const jobId = body.jobId || "unknown";
      await supabaseAdmin.from("leads_raw").insert({
        name: `__job_complete__`, source: "system", status: "job_failed",
        tags: [`job:${jobId}`],
        enrichment_data: { job_id: jobId, status: "failed", error: e instanceof Error ? e.message : "Unknown error" },
      });
    } catch {}
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
