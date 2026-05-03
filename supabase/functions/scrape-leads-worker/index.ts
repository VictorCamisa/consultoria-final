import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER v2 — Serper (Google Places + Search) + Jina Reader
//
// Por que substituímos o Firecrawl:
//   • Serper /places usa o índice do Google Maps → retorna negócios brasileiros
//     com title, phoneNumber, website, address, rating já estruturados.
//     Sem precisar de IA pra extrair em ~80% dos casos (muito mais barato).
//   • Serper /search é Google Search puro com gl=br/hl=pt-br. Cobertura
//     incomparável em conteúdo brasileiro (vs Firecrawl que usa Bing/DDG).
//   • Jina Reader (r.jina.ai/{url}) converte qualquer página em markdown limpo,
//     gratuito até 200 req/min. Substitui o scrapeOptions do Firecrawl.
//
// Fluxo:
//   Phase 1: Serper /places → contatos diretos (nome, fone, site, ICP via Claude lite)
//   Phase 2: Serper /search + Jina (só quando /places não bastou) → IA extrai
//   Phase 3: Dedup + persist
//   Phase 4: Expansion via /places em cidades vizinhas
// ─────────────────────────────────────────────────────────────────────────────

type SerperPlace = {
  title?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  cid?: string;
  latitude?: number;
  longitude?: number;
};

type SerperSearchHit = { title?: string; link?: string; snippet?: string };

type ScrapedPage = { url: string; title?: string; markdown: string };

async function serperPlaces(apiKey: string, query: string, location: string): Promise<SerperPlace[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://google.serper.dev/places", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", location: location || "Brasil" }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data?.places) ? data.places : [];
      }
      const txt = (await resp.text()).slice(0, 200);
      console.error(`Serper /places ${resp.status} attempt ${attempt}: ${txt}`);
      if ([401, 402, 403].includes(resp.status)) return [];
      if (resp.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      if (resp.status >= 500 && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return [];
    } catch (e) {
      console.error(`Serper /places network error attempt ${attempt}:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function serperSearch(apiKey: string, query: string, num: number): Promise<SerperSearchHit[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", num: Math.min(num, 20) }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data?.organic) ? data.organic : [];
      }
      const txt = (await resp.text()).slice(0, 200);
      console.error(`Serper /search ${resp.status} attempt ${attempt}: ${txt}`);
      if ([401, 402, 403].includes(resp.status)) return [];
      if (resp.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      if (resp.status >= 500 && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return [];
    } catch (e) {
      console.error(`Serper /search network error attempt ${attempt}:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function jinaRead(url: string, apiKey?: string): Promise<string> {
  // Jina Reader: GET https://r.jina.ai/{url} → markdown limpo. Sem key = rate baixo mas funciona.
  try {
    const headers: Record<string, string> = { "X-Return-Format": "markdown" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const resp = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!resp.ok) {
      console.warn(`Jina ${resp.status} for ${url.slice(0, 80)}`);
      return "";
    }
    return (await resp.text()).slice(0, 4000);
  } catch (e) {
    console.warn(`Jina error for ${url.slice(0, 80)}:`, e);
    return "";
  }
}

const CONSULTORIA_VS_CONTEXT = `
EMPRESA: VS OS — Consultoria de Crescimento para negócios locais.
ICP: Donos de negócios locais, faturamento >R$30k/mês, equipe >=3, investem em marketing.
Score ICP 80-100=perfeito, 60-79=bom, 40-59=médio, 20-39=fraco, 0-19=ruim.
`.trim();

function buildPlacesQueries(niche: string, locationStr: string, intent: string): string[] {
  const city = (locationStr || "").split(",")[0]?.trim() || "";
  const nicheLower = niche.toLowerCase();
  const base: string[] = [];

  if (nicheLower.includes("revenda") || nicheLower.includes("veículo") || nicheLower.includes("seminovo") || nicheLower.includes("carro") || nicheLower.includes("auto")) {
    base.push("revenda de veículos", "loja de carros usados", "multimarcas seminovos", "concessionária seminovos");
  } else if (nicheLower.includes("estética") || nicheLower.includes("estetic") || nicheLower.includes("depilação") || nicheLower.includes("skincare")) {
    base.push("clínica de estética", "estética avançada", "centro de estética", "clínica de depilação");
  } else if (nicheLower.includes("odonto") || nicheLower.includes("dentist")) {
    base.push("clínica odontológica", "dentista", "consultório odontológico", "ortodontia");
  } else if (nicheLower.includes("advoca") || nicheLower.includes("jurídic") || nicheLower.includes("direito")) {
    base.push("escritório de advocacia", "advogado", "advocacia trabalhista", "advocacia empresarial");
  } else {
    base.push(niche, `${niche} empresa`, `${niche} clínica`, `${niche} escritório`);
  }

  const queries = base.map(q => city ? `${q} em ${city}` : q);
  if (intent?.trim()) queries.push(`${base[0]} ${intent.trim().slice(0, 60)}${city ? ` ${city}` : ""}`);
  return Array.from(new Set(queries)).slice(0, 5);
}

function buildSearchQueries(niche: string, locationStr: string, intent: string): string[] {
  const city = (locationStr || "").split(",")[0]?.trim() || "";
  const queries: string[] = [
    `${niche} ${city} contato site WhatsApp`,
    `${niche} ${city} telefone empresa`,
    `"${niche}" "${city}" contato`,
  ];
  if (intent?.trim()) queries.push(`${niche} ${city} ${intent.trim().slice(0, 80)}`);
  return queries.slice(0, 4);
}

function buildExpansionPlacesQueries(niche: string, locationStr: string): string[] {
  const parts = (locationStr || "").split(",");
  const city = parts[0]?.trim() || "";
  const state = parts[parts.length - 1]?.trim() || "";
  const nicheLower = niche.toLowerCase();
  let core = niche;
  if (nicheLower.includes("revenda") || nicheLower.includes("seminovo")) core = "revenda de veículos";
  else if (nicheLower.includes("estética") || nicheLower.includes("estetic")) core = "clínica de estética";
  else if (nicheLower.includes("odonto") || nicheLower.includes("dentist")) core = "clínica odontológica";
  else if (nicheLower.includes("advoca")) core = "escritório de advocacia";
  return [
    state ? `${core} ${state}` : `${core} interior`,
    `${core} região metropolitana ${city}`,
    `${core} ${state || "Brasil"} interior`,
  ].filter(Boolean);
}

/** Mapeia um SerperPlace direto pra um "contato" pronto (sem IA). */
function placeToContact(p: SerperPlace, niche: string, locationStr: string) {
  const phone = p.phoneNumber || null;
  return {
    name: p.title || null,
    company: p.title || null,
    phone,
    email: null,
    role: null,
    city: (p.address || "").split(",").slice(-2, -1)[0]?.trim() || locationStr.split(",")[0]?.trim() || null,
    website: p.website || null,
    segment: p.category || niche,
    company_size: null,
    icp_score: scorePlaceICP(p),
    icp_reason: p.rating ? `Rating ${p.rating} (${p.ratingCount ?? 0} reviews) · ${p.category ?? niche}` : `${p.category ?? niche}`,
  };
}

/** Score ICP heurístico baseado em sinais públicos (sem custo de IA). */
function scorePlaceICP(p: SerperPlace): number {
  let score = 50;
  if (p.website) score += 15;
  if (p.phoneNumber) score += 10;
  if (typeof p.rating === "number") {
    if (p.rating >= 4.5) score += 10;
    else if (p.rating >= 4.0) score += 5;
    else if (p.rating < 3.5) score -= 10;
  }
  if (typeof p.ratingCount === "number") {
    if (p.ratingCount >= 50) score += 10;
    else if (p.ratingCount >= 20) score += 5;
    else if (p.ratingCount < 5) score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

/** Para páginas sem dado estruturado, usa Claude pra extrair contatos do markdown. */
async function extractContactsFromPages(
  pages: ScrapedPage[],
  niche: string,
  locationStr: string,
  prospecting_intent: string,
  jobId: string,
): Promise<any[]> {
  if (pages.length === 0) return [];
  const { callClaude } = await import("../_shared/ai-client.ts");
  const BATCH_SIZE = 8;
  const all: any[] = [];

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const pagesContent = batch.map((r, idx) => {
      const md = (r.markdown || "").substring(0, 2500);
      return `--- PÁG ${idx + 1}: ${r.title ?? ""} (${r.url}) ---\n${md}`;
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
        const matches = aiContent.matchAll(/\{\s*"name"\s*:\s*(?:"[^"]*"|null)[\s\S]*?"icp_score"\s*:\s*\d+[\s\S]*?\}/g);
        for (const m of matches) { try { contacts.push(JSON.parse(m[0])); } catch {} }
      }
      console.log(`[${jobId}] AI batch ${batchNum}: extracted ${contacts.length} contacts`);
      all.push(...contacts);
    } catch (e) {
      console.error(`[${jobId}] AI batch ${batchNum} error:`, e);
    }
  }
  return all;
}

const formatPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  return null;
};

const capitalizeName = (name: string | null | undefined): string | null =>
  name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") ?? "";
    const JINA_API_KEY = Deno.env.get("JINA_API_KEY") ?? "";

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { niche, locationStr, desiredCount, prospecting_intent, jobId } = await req.json();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[${jobId}] Worker v2 (Serper+Jina): "${niche}" in "${locationStr}" (${desiredCount} leads)`);

    if (!SERPER_API_KEY) {
      await supabaseAdmin.from("leads_raw").insert({
        name: `__job_complete__`, source: "system", status: "job_failed",
        tags: [`job:${jobId}`],
        enrichment_data: { job_id: jobId, status: "failed", error: "SERPER_API_KEY ausente" },
      });
      return new Response(JSON.stringify({ error: "SERPER_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PHASE 1: Serper Places → contatos diretos sem IA ────────────────────
    const placesQueries = buildPlacesQueries(niche, locationStr, prospecting_intent);
    const allPlaces: SerperPlace[] = [];
    const seenPlaceKeys = new Set<string>();

    for (const q of placesQueries) {
      const places = await serperPlaces(SERPER_API_KEY, q, locationStr);
      for (const p of places) {
        const key = (p.cid || `${p.title}|${p.address}`).toLowerCase();
        if (!seenPlaceKeys.has(key)) {
          seenPlaceKeys.add(key);
          allPlaces.push(p);
        }
      }
    }
    console.log(`[${jobId}] Phase 1: ${allPlaces.length} places`);

    const placeContacts = allPlaces.map(p => placeToContact(p, niche, locationStr));

    // ─── PHASE 2: complementa com Search + Jina se ainda preciso ─────────────
    const seenUrls = new Set<string>();
    const scrapedPages: ScrapedPage[] = [];
    let searchUsed = false;

    if (placeContacts.filter(c => c.phone).length < desiredCount) {
      searchUsed = true;
      const searchQueries = buildSearchQueries(niche, locationStr, prospecting_intent);
      const allHits: SerperSearchHit[] = [];
      for (const q of searchQueries) {
        const hits = await serperSearch(SERPER_API_KEY, q, 15);
        for (const h of hits) {
          const url = h.link || "";
          if (url && !seenUrls.has(url)) { seenUrls.add(url); allHits.push(h); }
        }
      }
      console.log(`[${jobId}] Phase 2: ${allHits.length} unique URLs from search`);

      // Limita o nº de páginas que rodam Jina (cada uma é uma req)
      const toScrape = allHits.slice(0, 20);
      const scraped = await Promise.all(toScrape.map(async (h) => {
        const md = await jinaRead(h.link!, JINA_API_KEY);
        return md ? { url: h.link!, title: h.title, markdown: md } : null;
      }));
      for (const s of scraped) if (s) scrapedPages.push(s);
      console.log(`[${jobId}] Phase 2: ${scrapedPages.length} pages scraped via Jina`);
    }

    const aiContacts = await extractContactsFromPages(scrapedPages, niche, locationStr, prospecting_intent, jobId);

    // ─── PHASE 3: merge, dedup, persist ──────────────────────────────────────
    const allContacts = [...placeContacts, ...aiContacts];

    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueContacts = allContacts.filter((c: any) => {
      const phone = formatPhone(c.phone);
      const email = c.email?.toLowerCase()?.trim();
      if (phone && seenPhones.has(phone)) return false;
      if (!phone && email && seenEmails.has(email)) return false;
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      return phone || email || c.website;
    });

    uniqueContacts.sort((a: any, b: any) => (b.icp_score || 50) - (a.icp_score || 50));

    const phonesToCheck = uniqueContacts.map((c: any) => formatPhone(c.phone)).filter(Boolean) as string[];
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
        const phone = formatPhone(c.phone);
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
            scraper: "serper+jina",
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

    // ─── PHASE 4: Expansion via Places em cidades vizinhas ───────────────────
    if (savedCount < desiredCount) {
      const needed = desiredCount - savedCount;
      console.log(`[${jobId}] Phase 4: need ${needed} more — expanding via Places (regional)...`);

      const expansionQueries = buildExpansionPlacesQueries(niche, locationStr);
      const expandPlaces: SerperPlace[] = [];
      for (const q of expansionQueries) {
        const places = await serperPlaces(SERPER_API_KEY, q, "Brasil");
        for (const p of places) {
          const key = (p.cid || `${p.title}|${p.address}`).toLowerCase();
          if (!seenPlaceKeys.has(key)) { seenPlaceKeys.add(key); expandPlaces.push(p); }
        }
      }
      console.log(`[${jobId}] Phase 4: ${expandPlaces.length} new places from expansion`);

      const expandContacts = expandPlaces
        .map(p => placeToContact(p, niche, locationStr))
        .filter((c: any) => {
          const phone = formatPhone(c.phone);
          const email = c.email?.toLowerCase()?.trim();
          if (phone && seenPhones.has(phone)) return false;
          if (!phone && email && seenEmails.has(email)) return false;
          if (phone) seenPhones.add(phone);
          if (email) seenEmails.add(email);
          return phone || email || c.website;
        });

      const expandPhones = expandContacts.map((c: any) => formatPhone(c.phone)).filter(Boolean) as string[];
      if (expandPhones.length > 0) {
        const [{ data: rawExp }, { data: prospectsExp }] = await Promise.all([
          supabaseAdmin.from("leads_raw").select("phone").in("phone", expandPhones),
          supabaseAdmin.from("consultoria_prospects").select("whatsapp").in("whatsapp", expandPhones),
        ]);
        (rawExp || []).forEach((l: any) => existingPhones.add(l.phone));
        (prospectsExp || []).forEach((l: any) => existingPhones.add(l.whatsapp));
      }

      const expandNewLeads = expandContacts
        .map((c: any) => {
          const phone = formatPhone(c.phone);
          const icpScore = typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50;
          if (phone && existingPhones.has(phone)) return null;
          return {
            name: capitalizeName(c.name || c.company || "") || "Lead sem nome",
            phone,
            email: null,
            source: "web" as const,
            status: "pending" as const,
            tags: [`job:${jobId}`, "expansion"],
            enrichment_data: {
              company: c.company || null, city: c.city || null,
              website: c.website || null, segment: c.segment || niche,
              scraped_niche: niche, scraped_location: locationStr,
              scraped_at: new Date().toISOString(),
              prospecting_intent: prospecting_intent || null,
              icp_score: icpScore, icp_reason: c.icp_reason || null,
              job_id: jobId, expansion: true,
              scraper: "serper+jina",
            },
          };
        })
        .filter(Boolean);

      if (expandNewLeads.length > 0) {
        for (let i = 0; i < expandNewLeads.length; i += 50) {
          const chunk = expandNewLeads.slice(i, i + 50);
          const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(chunk);
          if (insertError) console.error("Expand insert error:", insertError);
          else savedCount += chunk.length;
        }
      }
      uniqueContacts.push(...expandContacts);
      console.log(`[${jobId}] Phase 4 done: +${expandNewLeads.length} leads (total ${savedCount})`);
    }

    // ─── Sentinel ────────────────────────────────────────────────────────────
    await supabaseAdmin.from("leads_raw").insert({
      name: `__job_complete__`,
      source: "system",
      status: "job_complete",
      tags: [`job:${jobId}`],
      enrichment_data: {
        job_id: jobId, status: "completed",
        count: savedCount, total_found: uniqueContacts.length,
        duplicates_skipped: uniqueContacts.length - newLeads.length,
        places_searched: allPlaces.length,
        pages_scraped: scrapedPages.length,
        pages_searched: allPlaces.length + scrapedPages.length,
        used_search_fallback: searchUsed,
        avg_icp_score: uniqueContacts.length
          ? Math.round(uniqueContacts.reduce((s: number, c: any) => s + (c.icp_score || 50), 0) / uniqueContacts.length)
          : 0,
        results: uniqueContacts.slice(0, 100).map((c: any) => ({
          name: capitalizeName(c.name || c.company || "") || null,
          phone: formatPhone(c.phone), email: c.email || null,
          company: c.company || null, city: c.city || null,
          website: c.website || null, segment: c.segment || null,
          icp_score: typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50,
          icp_reason: c.icp_reason || null,
        })),
        scraper: "serper+jina",
      },
    });

    console.log(`[${jobId}] DONE: ${savedCount} saved, places=${allPlaces.length}, pages=${scrapedPages.length}`);

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
