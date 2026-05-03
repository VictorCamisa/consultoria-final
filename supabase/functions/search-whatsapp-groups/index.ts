import { corsHeaders } from "../_shared/cors.ts";

// Busca grupos de WhatsApp via Serper (Google Search) — substitui Firecrawl.
// Google indexa chat.whatsapp.com, então site:chat.whatsapp.com retorna grupos diretos.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, region, limit } = await req.json();
    if (!niche) {
      return new Response(JSON.stringify({ success: false, error: "Nicho é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("SERPER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "SERPER_API_KEY não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const regionPart = region ? ` ${region}` : "";
    const num = Math.min(limit || 20, 30);

    async function serperSearch(q: string, n: number) {
      const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "br", hl: "pt-br", num: Math.min(n, 20) }),
      });
      if (!resp.ok) return { organic: [] };
      return await resp.json();
    }

    const directQuery = `site:chat.whatsapp.com "${niche}"${regionPart}`;
    const dirQuery = `"grupo whatsapp" "${niche}"${regionPart} link convite`;

    const [directData, dirData] = await Promise.all([
      serperSearch(directQuery, num),
      serperSearch(dirQuery, 10),
    ]);

    const whatsappLinkRegex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g;
    const groupMap = new Map<string, { name: string; url: string; source: string }>();

    const directResults = directData?.organic || [];
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

    const dirResults = dirData?.organic || [];
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
    return new Response(JSON.stringify({ success: true, groups, total: groups.length, query: niche + regionPart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
