import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, region, limit } = await req.json();
    if (!niche) {
      return new Response(JSON.stringify({ success: false, error: "Nicho é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "Firecrawl não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const regionPart = region ? ` ${region}` : "";
    const query = `site:chat.whatsapp.com "${niche}"${regionPart} grupo whatsapp`;

    const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: Math.min(limit || 20, 30) }),
    });

    const searchData = await searchResp.json();
    if (!searchResp.ok) {
      return new Response(JSON.stringify({ success: false, error: searchData.error || "Erro na busca" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dirQuery = `"grupo whatsapp" "${niche}"${regionPart} link convite`;
    const dirResp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: dirQuery, limit: 10, scrapeOptions: { formats: ["links"] } }),
    });
    const dirData = await dirResp.json();

    const whatsappLinkRegex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/g;
    const groupMap = new Map<string, { name: string; url: string; source: string }>();

    const directResults = searchData?.data || searchData?.results || [];
    for (const r of directResults) {
      const url = r.url || "";
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

    const dirResults = dirData?.data || dirData?.results || [];
    for (const r of dirResults) {
      const pageUrl = r.url || "";
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
      const content = [r.markdown || "", r.description || "", JSON.stringify(r.links || [])].join(" ");
      const matches = content.match(whatsappLinkRegex) || [];
      for (const link of matches) {
        const code = link.split("/").pop();
        if (code && code.length > 10 && !groupMap.has(code)) {
          groupMap.set(code, {
            name: r.title?.replace(/ - WhatsApp.*$/i, "").trim() || `Grupo ${niche}`,
            url: `https://chat.whatsapp.com/${code}`,
            source: new URL(pageUrl || "https://unknown.com").hostname,
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
