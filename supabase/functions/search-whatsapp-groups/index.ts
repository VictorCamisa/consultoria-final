import { corsHeaders } from "../_shared/cors.ts";

// Busca grupos de WhatsApp via Google Custom Search API.
// Usa GOOGLE_API_KEY (já existente) + GOOGLE_CSE_ID (Programmable Search Engine).
// Para criar um CSE gratuito: https://programmablesearchengine.google.com/
// Configure como "Search the entire web" e cole o ID em GOOGLE_CSE_ID.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, region, limit } = await req.json();
    if (!niche) {
      return new Response(JSON.stringify({ success: false, error: "Nicho é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GOOGLE_AI_STUDIO") ?? "";
    const GOOGLE_CSE_ID = Deno.env.get("GOOGLE_CSE_ID") ?? "";

    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "GOOGLE_API_KEY não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const regionPart = region ? ` ${region}` : "";
    const num = Math.min(limit || 20, 10); // CSE max 10 por req

    async function googleSearch(q: string): Promise<any[]> {
      if (!GOOGLE_CSE_ID) {
        // Sem CSE ID, usa Jina Reader em URLs conhecidas de diretórios de grupos
        return [];
      }
      const params = new URLSearchParams({
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CSE_ID,
        q,
        gl: "br",
        hl: "pt-br",
        num: String(num),
      });
      try {
        const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
        if (!resp.ok) { console.error(`CSE ${resp.status}`); return []; }
        const data = await resp.json();
        return data?.items || [];
      } catch (e) {
        console.error("CSE error:", e);
        return [];
      }
    }

    const directQuery = `site:chat.whatsapp.com "${niche}"${regionPart}`;
    const dirQuery = `"grupo whatsapp" "${niche}"${regionPart} link convite`;

    const [directResults, dirResults] = await Promise.all([
      googleSearch(directQuery),
      googleSearch(dirQuery),
    ]);

    const whatsappLinkRegex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g;
    const groupMap = new Map<string, { name: string; url: string; source: string }>();

    for (const r of directResults) {
      const url = r.link || "";
      if (url.includes("chat.whatsapp.com")) {
        const code = url.split("/").pop();
        if (code && code.length > 10) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, "").replace(/WhatsApp Group/i, "").trim() || `Grupo ${niche}`,
            url: url.startsWith("https") ? url : `https://chat.whatsapp.com/${code}`,
            source: "busca direta",
          });
        }
      }
    }

    for (const r of dirResults) {
      const pageUrl = r.link || "";
      if (pageUrl.includes("chat.whatsapp.com")) {
        const code = pageUrl.split("/").pop();
        if (code && code.length > 10 && !groupMap.has(code)) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, "").trim() || `Grupo ${niche}`,
            url: `https://chat.whatsapp.com/${code}`,
            source: "diretório",
          });
        }
      }
      const content = [r.snippet || "", r.title || ""].join(" ");
      const matches = content.match(whatsappLinkRegex) || [];
      for (const link of matches) {
        const code = link.split("/").pop();
        if (code && code.length > 10 && !groupMap.has(code)) {
          let host = "unknown";
          try { host = new URL(pageUrl || "https://unknown.com").hostname; } catch {}
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, "").trim() || `Grupo ${niche}`,
            url: `https://chat.whatsapp.com/${code}`,
            source: host,
          });
        }
      }
    }

    const groups = Array.from(groupMap.values());
    const needsCseId = !GOOGLE_CSE_ID;

    return new Response(JSON.stringify({
      success: true,
      groups,
      total: groups.length,
      query: niche + regionPart,
      ...(needsCseId ? { warning: "Configure GOOGLE_CSE_ID para habilitar busca de grupos. Crie gratuitamente em programmablesearchengine.google.com" } : {}),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
