import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type FirecrawlResult = { results: any[]; error?: string; status?: number };

async function firecrawlSearch(apiKey: string, query: string, limit: number): Promise<FirecrawlResult> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, lang: "pt-br", country: "br", scrapeOptions: { formats: ["markdown"], onlyMainContent: false } }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { results: data?.data || data?.results || [] };
      }
      const errorText = await resp.text();
      console.error(`Firecrawl search error (${resp.status}) attempt ${attempt}: ${errorText.substring(0, 300)}`);
      // Auth/billing errors — don't retry, surface immediately
      if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
        return { results: [], error: `Firecrawl API error ${resp.status}: ${errorText.substring(0, 200)}`, status: resp.status };
      }
      // Rate limit — retry with backoff
      if (resp.status === 429) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 3000 * attempt)); continue; }
        return { results: [], error: "Firecrawl rate limit (429). Tente novamente em 1 minuto.", status: 429 };
      }
      // Server errors — retry
      if (resp.status >= 500 && attempt < 3) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      return { results: [], error: `Firecrawl error ${resp.status}`, status: resp.status };
    } catch (e) {
      console.error(`Firecrawl search network error attempt ${attempt}:`, e);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  return { results: [], error: "Firecrawl indisponível após 3 tentativas" };
}

async function firecrawlScrape(apiKey: string, url: string): Promise<string> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: false }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return data?.data?.markdown || data?.markdown || "";
  } catch { return ""; }
}

// ──────────────────────────────────────────────────
// CONSULTORIA VS — ICP CONTEXT
// ──────────────────────────────────────────────────
const CONSULTORIA_VS_CONTEXT = `
EMPRESA VENDEDORA (quem vai abordar os leads):
- Nome: VS Growth Hub — Consultoria de Crescimento
- Segmento: Consultoria em gestão comercial, marketing e atendimento para negócios locais
- Modelo de negócio: B2B (vende para donos de empresas locais)
- Nichos principais de atuação: Clínicas de Estética, Clínicas Odontológicas, Escritórios de Advocacia e Revendas de Veículos Seminovos (VS AUTO)
- Serviços: Diagnóstico empresarial, imersão, devolutiva com plano estratégico, acompanhamento mensal, automação comercial via WhatsApp
- Público-alvo ideal: Donos/decisores de negócios locais que faturam acima de R$ 30k/mês, têm equipe de pelo menos 3 pessoas, investem ou querem investir em marketing digital/tráfego pago, e precisam melhorar processos de atendimento, comercial e retenção de clientes
- Diferenciais: Metodologia proprietária de diagnóstico com scoring em 4 dimensões (Marketing, Comercial, Atendimento, Operação), plano de ação personalizado, acompanhamento com métricas
- Ticket médio: Fee de consultoria entre R$ 3.000 e R$ 10.000 + MRR de serviços recorrentes

CRITÉRIOS DE QUALIFICAÇÃO ICP (Ideal Customer Profile):
Com base no perfil da consultoria acima, avalie cada lead e atribua um icp_score de 0 a 100:
- 80-100: Lead PERFEITO — é exatamente o perfil ideal (clínica estética/odonto/advocacia com faturamento bom OU revenda de veículos 10-80 carros, interior SP/MG/PR)
- 60-79: Lead BOM — tem bom fit (nicho correto, indícios de estrutura e faturamento razoável)
- 40-59: Lead MÉDIO — fit razoável (nicho adjacente, pouca informação para qualificar, ou empresa muito pequena)
- 20-39: Lead FRACO — pouco alinhado (nicho errado, freelancer sem equipe, sem presença)
- 0-19: Lead RUIM — fora do perfil (pessoa física, empresa enorme, nicho totalmente diferente)

Preencha o campo "icp_score" e "icp_reason" (1 frase explicando o score) para cada lead.
`.trim();

function buildSmartQueries(
  niche: string,
  locationStr: string,
  prospectingIntent: string
): string[] {
  const loc = locationStr || "";
  const city = loc.split(",")[0]?.trim() || "";
  const nicheLower = niche.toLowerCase();

  // Queries especializadas para revendas de veículos
  if (nicheLower.includes("revenda") || nicheLower.includes("veículo") || nicheLower.includes("seminovo") || nicheLower.includes("carro")) {
    const queries: string[] = [
      `revenda seminovos ${city} telefone WhatsApp`,
      `loja de carros usados ${city} contato`,
      `multimarcas ${city} seminovos WhatsApp`,
      `site:olx.com.br "${city}" loja seminovos`,
      `site:webmotors.com.br "${city}" revenda`,
    ];
    if (prospectingIntent?.trim()) {
      queries.push(`revenda veículos ${loc} ${prospectingIntent.trim().slice(0, 80)}`);
    }
    return queries.filter(q => q.trim().length > 5);
  }

  // Queries genéricas para outros nichos
  const queries: string[] = [
    `${niche} ${loc} telefone contato`,
    `${niche} ${loc} WhatsApp celular`,
    `"${niche}" "${city}" site contato email`,
  ];

  if (prospectingIntent?.trim()) {
    queries.push(`${niche} ${loc} ${prospectingIntent.trim().slice(0, 100)}`);
  }

  queries.push(`${niche} ${loc} endereço CNPJ`);

  return queries.filter(q => q.trim().length > 5);
}

Deno.serve(async (req) => {
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!FIRECRAWL_API_KEY) return json({ error: "Firecrawl não configurado." }, 400);
    if (!OPENAI_API_KEY) return json({ error: "OpenAI API Key não configurada." }, 400);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { niche, city, state, bairro, limit = 20, prospecting_intent = "" } = await req.json();
    if (!niche) return json({ error: "niche é obrigatório" }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const locationParts: string[] = [];
    if (bairro) locationParts.push(bairro);
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    const locationStr = locationParts.join(", ");
    const desiredCount = Math.min(Math.max(limit, 5), 50);

    console.log(`=== PROSPECTING: "${niche}" in "${locationStr}" (want ${desiredCount} leads) ===`);
    console.log(`Prospecting intent: "${prospecting_intent || "not provided"}"`);

    // ──────────────────────────────────────────────────
    // PHASE 1: Smart, ICP-aware search queries
    // ──────────────────────────────────────────────────
    const queries = buildSmartQueries(niche, locationStr, prospecting_intent);
    const perQueryLimit = Math.ceil(desiredCount / 2);
    console.log(`Running ${queries.length} smart search queries (${perQueryLimit} results each)...`);

    const allSearchResults: any[] = [];
    const seenUrls = new Set<string>();
    let firecrawlError: string | null = null;
    let firecrawlStatus: number | undefined;

    for (let i = 0; i < queries.length; i += 2) {
      const batch = queries.slice(i, i + 2);
      const batchResults = await Promise.all(
        batch.map(q => firecrawlSearch(FIRECRAWL_API_KEY!, q, perQueryLimit))
      );
      for (const result of batchResults) {
        if (result.error && !firecrawlError) {
          firecrawlError = result.error;
          firecrawlStatus = result.status;
        }
        for (const r of result.results) {
          const url = r.url || r.metadata?.sourceURL || "";
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            allSearchResults.push(r);
          }
        }
      }
      if (i + 2 < queries.length) await new Promise(r => setTimeout(r, 500));
    }

    console.log(`Total unique pages from searches: ${allSearchResults.length}${firecrawlError ? ` | Firecrawl error: ${firecrawlError}` : ""}`);

    if (allSearchResults.length === 0) {
      // Surface the real Firecrawl error instead of generic message
      const errorMsg = firecrawlError
        ? `Erro no Firecrawl (${firecrawlStatus || "?"}): ${firecrawlError}`
        : "Nenhum resultado encontrado. Tente termos mais específicos.";
      return json({
        count: 0, results: [], pages_searched: 0,
        message: errorMsg,
        firecrawl_error: firecrawlError || null,
        firecrawl_status: firecrawlStatus || null,
      });
    }

    // ──────────────────────────────────────────────────
    // PHASE 2: Identify and scrape contact/about pages
    // ──────────────────────────────────────────────────
    const contactPageUrls: string[] = [];
    for (const r of allSearchResults) {
      const markdown = (r.markdown || r.content || "").toLowerCase();
      const hasPhone = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/.test(markdown) || /\+55\s?\d{2}/.test(markdown);
      if (!hasPhone) {
        const contactLinks = markdown.match(/https?:\/\/[^\s"')]+(?:contato|contact|fale-conosco|about|sobre|quem-somos)[^\s"')]*/);
        if (contactLinks) {
          const contactUrl = contactLinks[0];
          if (!seenUrls.has(contactUrl)) {
            contactPageUrls.push(contactUrl);
            seenUrls.add(contactUrl);
          }
        }
      }
    }

    const contactPagesToScrape = contactPageUrls.slice(0, 10);
    if (contactPagesToScrape.length > 0) {
      console.log(`Scraping ${contactPagesToScrape.length} contact pages...`);
      for (let i = 0; i < contactPagesToScrape.length; i += 3) {
        const batch = contactPagesToScrape.slice(i, i + 3);
        const scrapeResults = await Promise.all(
          batch.map(async (url) => {
            const md = await firecrawlScrape(FIRECRAWL_API_KEY, url);
            return { url, markdown: md, title: `Contato - ${url}`, metadata: { sourceURL: url } };
          })
        );
        for (const sr of scrapeResults) {
          if (sr.markdown) allSearchResults.push(sr);
        }
        if (i + 3 < contactPagesToScrape.length) await new Promise(r => setTimeout(r, 500));
      }
    }

    // ──────────────────────────────────────────────────
    // PHASE 3: Build rich context for AI extraction
    // ──────────────────────────────────────────────────
    const pagesContent = allSearchResults.map((r: any, i: number) => {
      const title = r.title || r.metadata?.title || `Resultado ${i + 1}`;
      const url = r.url || r.metadata?.sourceURL || "";
      const markdown = r.markdown || r.content || "";
      const trimmed = markdown.substring(0, 5000);
      return `--- PÁGINA ${i + 1}: ${title} (${url}) ---\n${trimmed}`;
    }).join("\n\n");

    // ──────────────────────────────────────────────────
    // PHASE 4: AI extraction WITH ICP qualification
    // ──────────────────────────────────────────────────
    const intentSection = prospecting_intent?.trim()
      ? `\nINTENÇÃO DE PROSPECÇÃO DO USUÁRIO:\n"${prospecting_intent.trim()}"\nConsidere essa intenção ao avaliar se cada lead é adequado.\n`
      : "";

    const extractionPrompt = `Analise TODAS as ${allSearchResults.length} páginas abaixo e extraia ABSOLUTAMENTE TODOS os contatos de empresas do segmento "${niche}" ${locationStr ? `localizadas em ${locationStr}` : ""}.
${intentSection}
PÁGINAS RASPADAS:
${pagesContent}

INSTRUÇÕES DE EXTRAÇÃO (SIGA RIGOROSAMENTE):

1. TELEFONE - Extraia TODOS os formatos:
   - (XX) XXXXX-XXXX, (XX) XXXX-XXXX
   - +55 XX XXXXX-XXXX
   - Apenas dígitos seguidos: 11999998888
   - WhatsApp: links wa.me/55XXXXXXXXXXX
   - Se houver múltiplos telefones, use o celular/WhatsApp

2. EMAIL - Busque em:
   - Links mailto:
   - Texto com @ no conteúdo
   - Padrões como contato@, atendimento@, comercial@

3. WEBSITE - Capture:
   - A URL da página onde o contato foi encontrado
   - Links para o site da empresa
   - Domínio principal da empresa

4. DADOS COMPLEMENTARES:
   - Nome da empresa/pessoa de contato
   - Cargo/função
   - Endereço/cidade
   - Segmento de atuação
   - CNPJ se disponível
   - Porte da empresa (micro/pequena/média/grande) se inferível

${locationStr ? `FILTRO DE LOCALIDADE:
- Priorize contatos de ${locationStr}
- Inclua contatos onde a cidade/estado seja compatível
- Se não puder confirmar a localidade mas o DDD for compatível, inclua` : ""}

${CONSULTORIA_VS_CONTEXT}

REGRAS CRÍTICAS:
- Extraia o MÁXIMO possível de contatos — meta: pelo menos ${desiredCount}
- NÃO pule nenhum contato que tenha pelo menos telefone OU email
- Se uma página tem vários contatos (lista, diretório), extraia TODOS
- NÃO invente dados, mas extraia tudo que existir nas páginas
- Cada empresa conta como 1 contato mesmo que tenha múltiplas pessoas

Responda APENAS com JSON válido:
{
  "contacts": [
    {
      "name": "string ou null",
      "phone": "string ou null",
      "email": "string ou null",
      "company": "string ou null",
      "role": "string ou null",
      "city": "string ou null",
      "website": "string ou null",
      "segment": "string ou null",
      "company_size": "string ou null",
      "icp_score": 0,
      "icp_reason": "string ou null"
    }
  ]
}`;

    console.log(`Sending ${allSearchResults.length} pages to AI for extraction + ICP qualification...`);

    const systemPrompt = `Você é um especialista em prospecção B2B e qualificação de leads para a Consultoria VS Growth Hub. Sua missão: encontrar TODOS os contatos empresariais nas páginas fornecidas E qualificar cada lead com um score de aderência ao ICP da consultoria. ${locationStr ? `Priorize contatos de ${locationStr}.` : ""} Retorne APENAS JSON válido, sem markdown, sem explicações.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extractionPrompt },
        ],
        max_tokens: 16384,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error("AI extraction error:", status, errorText);
      if (status === 429) return json({ error: "Limite de requisições OpenAI atingido. Tente em 1 minuto." }, 429);
      if (status === 402 || status === 401) return json({ error: "Erro na API OpenAI. Verifique sua API Key e créditos." }, 402);
      return json({ error: `Erro na extração por IA: Status ${status}` }, 502);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let contacts: any[] = [];
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) contacts = JSON.parse(jsonMatch[0]).contacts || [];
    } catch (e) {
      // Try to salvage truncated JSON by extracting individual contact objects
      console.error("JSON parse error, attempting salvage:", (e as Error).message);
      try {
        const contactMatches = aiContent.matchAll(/\{\s*"name"\s*:\s*(?:"[^"]*"|null)\s*,\s*"phone"\s*:\s*(?:"[^"]*"|null)\s*,\s*"email"\s*:\s*(?:"[^"]*"|null)\s*,\s*"company"\s*:\s*(?:"[^"]*"|null)\s*,\s*"role"\s*:\s*(?:"[^"]*"|null)\s*,\s*"city"\s*:\s*(?:"[^"]*"|null)\s*,\s*"website"\s*:\s*(?:"[^"]*"|null)\s*,\s*"segment"\s*:\s*(?:"[^"]*"|null)\s*,\s*"company_size"\s*:\s*(?:"[^"]*"|null)\s*,\s*"icp_score"\s*:\s*\d+\s*,\s*"icp_reason"\s*:\s*(?:"[^"]*"|null)\s*\}/g);
        for (const m of contactMatches) {
          try { contacts.push(JSON.parse(m[0])); } catch {}
        }
        console.log(`Salvaged ${contacts.length} contacts from truncated JSON`);
      } catch {}
      if (contacts.length === 0) {
        console.error("Could not salvage any contacts. Content preview:", aiContent.substring(0, 500));
      }
    }

    console.log(`AI extracted ${contacts.length} contacts`);

    if (contacts.length === 0) {
      return json({ count: 0, results: [], pages_searched: allSearchResults.length, message: "Nenhum contato extraído. Tente termos mais específicos." });
    }

    // ──────────────────────────────────────────────────
    // PHASE 5: Format, deduplicate, and save
    // ──────────────────────────────────────────────────
    const formatPhone = (phone: string): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) return null;
      if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
      if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
      if (digits.length === 8 || digits.length === 9) return null;
      return `+${digits}`;
    };

    const capitalizeName = (name: string): string | null =>
      name ? name.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null;

    // Deduplicate within batch
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

    // Sort by ICP score descending (best leads first)
    uniqueContacts.sort((a: any, b: any) => (b.icp_score || 50) - (a.icp_score || 50));

    // Check DB duplicates
    const phonesToCheck = uniqueContacts.map((c: any) => formatPhone(c.phone || "")).filter(Boolean) as string[];
    const emailsToCheck = uniqueContacts.map((c: any) => c.email?.toLowerCase()?.trim()).filter(Boolean) as string[];

    let existingPhones = new Set<string>();
    let existingEmails = new Set<string>();

    if (phonesToCheck.length > 0) {
      const { data: existingByPhone } = await supabaseAdmin.from("leads_raw").select("phone").in("phone", phonesToCheck);
      existingPhones = new Set((existingByPhone || []).map((l: any) => l.phone));
    }
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
          enrichment_data: {
            company: c.company || null, role: c.role || null, city: c.city || null,
            website: c.website || null, segment: c.segment || niche,
            company_size: c.company_size || null,
            scraped_niche: niche, scraped_location: locationStr,
            scraped_at: new Date().toISOString(),
            prospecting_intent: prospecting_intent || null,
            icp_score: icpScore, icp_reason: c.icp_reason || null,
          },
        };
      })
      .filter(Boolean);

    // Save in batches
    let savedCount = 0;
    if (newLeads.length > 0) {
      for (let i = 0; i < newLeads.length; i += 100) {
        const chunk = newLeads.slice(i, i + 100);
        const { error: insertError } = await supabaseAdmin.from("leads_raw").insert(chunk);
        if (insertError) console.error("Insert error:", insertError);
        else savedCount += chunk.length;
      }
    }

    const displayResults = uniqueContacts.map((c: any) => ({
      name: capitalizeName(c.name || c.company || "") || null,
      phone: formatPhone(c.phone || ""), email: c.email || null,
      company: c.company || null, role: c.role || null, city: c.city || null,
      website: c.website || null, segment: c.segment || null, company_size: c.company_size || null,
      icp_score: typeof c.icp_score === "number" ? Math.min(100, Math.max(0, Math.round(c.icp_score))) : 50,
      icp_reason: c.icp_reason || null,
    }));

    const avgIcpScore = displayResults.length
      ? Math.round(displayResults.reduce((sum: number, r: any) => sum + (r.icp_score || 50), 0) / displayResults.length)
      : 0;

    console.log(`=== DONE: ${savedCount} saved, ${contacts.length - newLeads.length} dupes, ${allSearchResults.length} pages searched, avg ICP: ${avgIcpScore} ===`);

    return json({
      count: savedCount, total_found: contacts.length,
      duplicates_skipped: contacts.length - newLeads.length,
      pages_searched: allSearchResults.length, results: displayResults,
      avg_icp_score: avgIcpScore,
    });

  } catch (e) {
    console.error("scrape-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
