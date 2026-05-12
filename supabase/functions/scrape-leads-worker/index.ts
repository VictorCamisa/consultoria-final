import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER v3 — Google Places API (New) + Jina Reader
//
// Usa GOOGLE_API_KEY (já existente no projeto). Zero novas APIs.
//
// Fluxo:
//   Phase 1: Google Places Text Search → contatos diretos estruturados
//            (nome, fone, site, endereço, rating) sem precisar de IA
//   Phase 2: Jina Reader (r.jina.ai) nos sites encontrados → OpenAI extrai
//            emails e detalhes adicionais quando Places não tem fone
//   Phase 3: Dedup + persist
//   Phase 4: Expansion regional via Places
//
// Pricing Google Places (New):
//   Text Search: $17/1000 req · crédito grátis $200/mês ≈ 11.700 req livres
// ─────────────────────────────────────────────────────────────────────────────

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
};

type ScrapedPage = { url: string; title?: string; markdown: string };

async function googlePlacesSearch(apiKey: string, textQuery: string): Promise<GooglePlace[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.displayName",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.websiteUri",
            "places.rating",
            "places.userRatingCount",
            "places.types",
            "places.businessStatus",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery,
          languageCode: "pt-BR",
          regionCode: "BR",
          maxResultCount: 20,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data?.places) ? data.places : [];
      }
      const txt = (await resp.text()).slice(0, 300);
      console.error(`Google Places ${resp.status} attempt ${attempt}: ${txt}`);
      if ([400, 401, 403].includes(resp.status)) return [];
      if (resp.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      if (resp.status >= 500 && attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return [];
    } catch (e) {
      console.error(`Google Places network error attempt ${attempt}:`, e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return [];
}

async function jinaRead(url: string): Promise<string> {
  try {
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "X-Return-Format": "markdown" },
    });
    if (!resp.ok) { console.warn(`Jina ${resp.status} for ${url.slice(0, 80)}`); return ""; }
    return (await resp.text()).slice(0, 4000);
  } catch (e) {
    console.warn(`Jina error for ${url.slice(0, 80)}:`, e);
    return "";
  }
}

function buildPlacesQueries(niche: string, locationStr: string, intent: string): string[] {
  const city = (locationStr || "").split(",")[0]?.trim() || "";
  const nicheLower = niche.toLowerCase();
  const loc = city ? ` em ${city}` : "";
  let terms: string[];

  if (nicheLower.includes("revenda") || nicheLower.includes("veículo") || nicheLower.includes("seminovo") || nicheLower.includes("carro") || nicheLower.includes("auto")) {
    terms = ["revenda de veículos", "loja de carros usados", "multimarcas seminovos", "concessionária de seminovos"];
  } else if (nicheLower.includes("estética") || nicheLower.includes("estetic") || nicheLower.includes("depilação") || nicheLower.includes("skincare")) {
    terms = ["clínica de estética", "centro de estética", "estética avançada", "clínica de depilação a laser"];
  } else if (nicheLower.includes("odonto") || nicheLower.includes("dentist")) {
    terms = ["clínica odontológica", "dentista", "consultório odontológico", "clínica de ortodontia"];
  } else if (nicheLower.includes("advoca") || nicheLower.includes("jurídic") || nicheLower.includes("direito")) {
    terms = ["escritório de advocacia", "advogado", "advocacia empresarial", "advocacia trabalhista"];
  } else {
    terms = [niche, `${niche} empresa`, `empresa de ${niche}`, `${niche} profissional`];
  }

  const queries = terms.map(t => `${t}${loc}`);
  if (intent?.trim()) queries.push(`${terms[0]}${loc} ${intent.trim().slice(0, 60)}`);
  return Array.from(new Set(queries)).slice(0, 5);
}

function buildExpansionQueries(niche: string, locationStr: string): string[] {
  const parts = (locationStr || "").split(",");
  const city = parts[0]?.trim() || "";
  const state = parts[parts.length - 1]?.trim() || "";
  const nicheLower = niche.toLowerCase();
  let core = niche;
  if (nicheLower.includes("revenda") || nicheLower.includes("seminovo")) core = "revenda de veículos";
  else if (nicheLower.includes("estética") || nicheLower.includes("estetic")) core = "clínica de estética";
  else if (nicheLower.includes("odonto") || nicheLower.includes("dentist")) core = "clínica odontológica";
  else if (nicheLower.includes("advoca")) core = "escritório de advocacia";
  const queries: string[] = [];
  if (state) queries.push(`${core} ${state}`);
  if (city) queries.push(`${core} região metropolitana de ${city}`);
  if (state) queries.push(`${core} interior de ${state}`);
  return queries.filter(Boolean).slice(0, 3);
}

function placeToContact(p: GooglePlace, niche: string, locationStr: string) {
  const name = p.displayName?.text || null;
  const address = p.formattedAddress || "";
  const cityFromAddress = address.split(",").slice(-3, -2)[0]?.trim() || locationStr.split(",")[0]?.trim() || null;
  return {
    name,
    company: name,
    phone: p.nationalPhoneNumber || null,
    email: null,
    role: null,
    city: cityFromAddress,
    website: p.websiteUri || null,
    segment: (p.types ?? []).join(", ") || niche,
    company_size: null,
    icp_score: scorePlaceICP(p),
    icp_reason: buildIcpReason(p, niche),
    address,
  };
}

function scorePlaceICP(p: GooglePlace): number {
  let score = 50;
  if (p.websiteUri) score += 15;
  if (p.nationalPhoneNumber) score += 10;
  if (typeof p.rating === "number") {
    if (p.rating >= 4.5) score += 10;
    else if (p.rating >= 4.0) score += 5;
    else if (p.rating < 3.5) score -= 10;
  }
  if (typeof p.userRatingCount === "number") {
    if (p.userRatingCount >= 50) score += 10;
    else if (p.userRatingCount >= 20) score += 5;
    else if (p.userRatingCount < 5) score -= 5;
  }
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") score -= 20;
  return Math.max(0, Math.min(100, score));
}

function buildIcpReason(p: GooglePlace, niche: string): string {
  const parts: string[] = [];
  if (p.rating) parts.push(`Rating ${p.rating} (${p.userRatingCount ?? 0} reviews)`);
  if (p.websiteUri) parts.push("tem site");
  if (p.nationalPhoneNumber) parts.push("tem fone");
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") parts.push(`status: ${p.businessStatus}`);
  return parts.length ? parts.join(" · ") : niche;
}

async function enrichContactsViaJina(
  contacts: any[],
  niche: string,
  locationStr: string,
  prospecting_intent: string,
  jobId: string,
): Promise<any[]> {
  // Só enriche contatos sem fone que têm website (tenta extrair email/fone do site)
  const toEnrich = contacts.filter(c => !c.phone && c.website).slice(0, 15);
  if (toEnrich.length === 0) return contacts;

  const { callClaude } = await import("../_shared/ai-client.ts");
  console.log(`[${jobId}] Enriching ${toEnrich.length} contacts via Jina + OpenAI...`);

  const pages: ScrapedPage[] = [];
  await Promise.all(toEnrich.map(async (c) => {
    const md = await jinaRead(c.website!);
    if (md) pages.push({ url: c.website!, title: c.company || "", markdown: md });
  }));

  if (pages.length === 0) return contacts;

  const pagesContent = pages.map((p, i) => `--- ${i + 1}: ${p.title} (${p.url}) ---\n${p.markdown}`).join("\n\n");
  const prompt = `Extraia telefone e email das páginas de negócios "${niche}" ${locationStr ? `em ${locationStr}` : ""} abaixo.
${pagesContent}

Responda APENAS JSON: {"contacts":[{"website":"str","phone":"str|null","email":"str|null"}]}`;

  try {
    const aiResult = await callClaude({
      system: "Extraia APENAS phone e email dos sites. Retorne APENAS JSON válido.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
    });
    const jsonMatch = (aiResult.text ?? "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) return contacts;
    const enriched: { website: string; phone?: string; email?: string }[] = JSON.parse(jsonMatch[0]).contacts || [];
    const byWebsite = new Map(enriched.map(e => [e.website, e]));
    return contacts.map(c => {
      if (!c.website || c.phone) return c;
      const e = byWebsite.get(c.website);
      if (!e) return c;
      return { ...c, phone: e.phone || c.phone, email: e.email || c.email };
    });
  } catch (e) {
    console.error(`[${jobId}] Jina enrich error:`, e);
    return contacts;
  }
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
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ?? "";

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { niche, locationStr, desiredCount, prospecting_intent, jobId } = await req.json();
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[${jobId}] Worker v3 (Google Places + Jina): "${niche}" in "${locationStr}" (${desiredCount} leads)`);

    if (!GOOGLE_API_KEY) {
      await supabaseAdmin.from("leads_raw").insert({
        name: `__job_complete__`, source: "system", status: "job_failed",
        tags: [`job:${jobId}`],
        enrichment_data: { job_id: jobId, status: "failed", error: "GOOGLE_API_KEY ausente" },
      });
      return new Response(JSON.stringify({ error: "GOOGLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PHASE 1: Google Places Text Search → dados estruturados sem IA ──────
    const placesQueries = buildPlacesQueries(niche, locationStr, prospecting_intent);
    const allPlaces: GooglePlace[] = [];
    const seenPlaceKeys = new Set<string>();

    for (const q of placesQueries) {
      const places = await googlePlacesSearch(GOOGLE_API_KEY, q);
      for (const p of places) {
        // Ignora negócios fechados permanentemente
        if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
        const key = `${p.displayName?.text ?? ""}|${p.formattedAddress ?? ""}`.toLowerCase();
        if (!seenPlaceKeys.has(key)) {
          seenPlaceKeys.add(key);
          allPlaces.push(p);
        }
      }
    }
    console.log(`[${jobId}] Phase 1: ${allPlaces.length} places from Google`);

    let contacts = allPlaces.map(p => placeToContact(p, niche, locationStr));

    // ─── PHASE 2: Enriquece (via Jina + OpenAI) contatos sem fone ───────────
    contacts = await enrichContactsViaJina(contacts, niche, locationStr, prospecting_intent, jobId);

    // ─── PHASE 3: Dedup + persist ─────────────────────────────────────────────
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueContacts = contacts.filter((c: any) => {
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
            company: c.company || null, role: c.role || null,
            city: c.city || null, address: c.address || null,
            website: c.website || null, segment: c.segment || niche,
            company_size: c.company_size || null,
            scraped_niche: niche, scraped_location: locationStr,
            scraped_at: new Date().toISOString(),
            prospecting_intent: prospecting_intent || null,
            icp_score: icpScore, icp_reason: c.icp_reason || null,
            job_id: jobId,
            scraper: "google-places+jina",
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

    // ─── PHASE 4: Expansão regional via Google Places ─────────────────────────
    if (savedCount < desiredCount) {
      console.log(`[${jobId}] Phase 4: need ${desiredCount - savedCount} more — expanding regionally...`);
      const expandQueries = buildExpansionQueries(niche, locationStr);
      const expandPlaces: GooglePlace[] = [];

      for (const q of expandQueries) {
        const places = await googlePlacesSearch(GOOGLE_API_KEY, q);
        for (const p of places) {
          if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
          const key = `${p.displayName?.text ?? ""}|${p.formattedAddress ?? ""}`.toLowerCase();
          if (!seenPlaceKeys.has(key)) { seenPlaceKeys.add(key); expandPlaces.push(p); }
        }
      }
      console.log(`[${jobId}] Phase 4: ${expandPlaces.length} new places (expansion)`);

      let expandContacts = expandPlaces.map(p => placeToContact(p, niche, locationStr));
      expandContacts = await enrichContactsViaJina(expandContacts, niche, locationStr, prospecting_intent, jobId);

      const expandUnique = expandContacts.filter((c: any) => {
        const phone = formatPhone(c.phone);
        const email = c.email?.toLowerCase()?.trim();
        if (phone && seenPhones.has(phone)) return false;
        if (!phone && email && seenEmails.has(email)) return false;
        if (phone) seenPhones.add(phone);
        if (email) seenEmails.add(email);
        return phone || email || c.website;
      });

      const expandPhones = expandUnique.map((c: any) => formatPhone(c.phone)).filter(Boolean) as string[];
      if (expandPhones.length > 0) {
        const [{ data: rawExp }, { data: prospectsExp }] = await Promise.all([
          supabaseAdmin.from("leads_raw").select("phone").in("phone", expandPhones),
          supabaseAdmin.from("consultoria_prospects").select("whatsapp").in("whatsapp", expandPhones),
        ]);
        (rawExp || []).forEach((l: any) => existingPhones.add(l.phone));
        (prospectsExp || []).forEach((l: any) => existingPhones.add(l.whatsapp));
      }

      const expandNewLeads = expandUnique
        .map((c: any) => {
          const phone = formatPhone(c.phone);
          const icpScore = typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50;
          if (phone && existingPhones.has(phone)) return null;
          return {
            name: capitalizeName(c.name || c.company || "") || "Lead sem nome",
            phone,
            email: c.email?.toLowerCase()?.trim() || null,
            source: "web" as const,
            status: "pending" as const,
            tags: [`job:${jobId}`, "expansion"],
            enrichment_data: {
              company: c.company || null, city: c.city || null, address: c.address || null,
              website: c.website || null, segment: c.segment || niche,
              scraped_niche: niche, scraped_location: locationStr,
              scraped_at: new Date().toISOString(),
              prospecting_intent: prospecting_intent || null,
              icp_score: icpScore, icp_reason: c.icp_reason || null,
              job_id: jobId, expansion: true,
              scraper: "google-places+jina",
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
      uniqueContacts.push(...expandUnique);
      console.log(`[${jobId}] Phase 4 done: +${expandNewLeads.length} leads (total ${savedCount})`);
    }

    // ─── Sentinel ─────────────────────────────────────────────────────────────
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
        pages_searched: allPlaces.length,
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
        scraper: "google-places+jina",
      },
    });

    console.log(`[${jobId}] DONE: ${savedCount} saved, ${allPlaces.length} places searched`);
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
