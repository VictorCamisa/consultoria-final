// Publica um post (carrossel ou imagem única) no Instagram via Graph API.
// Requer secrets: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

async function igFetch(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const url = new URL(`${GRAPH}${path}`);
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`IG API ${path} [${res.status}]: ${JSON.stringify(json)}`);
  }
  return json;
}

async function waitForContainer(creationId: string, token: string, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    const j = await igFetch(`/${creationId}`, { fields: "status_code,status", access_token: token }, "GET");
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") {
      throw new Error(`Container ${creationId} status: ${j.status_code} - ${j.status ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Container ${creationId} não finalizou a tempo`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
    const IG_USER_ID = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
    if (!TOKEN || !IG_USER_ID) throw new Error("INSTAGRAM_ACCESS_TOKEN ou INSTAGRAM_BUSINESS_ACCOUNT_ID não configurados");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { post_id, caption } = await req.json();
    if (!post_id || typeof caption !== "string") {
      return new Response(JSON.stringify({ error: "post_id e caption obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    // Carrega slides ordenados
    const { data: slides, error: sErr } = await admin
      .from("imagery_slides")
      .select("slide_n, final_png_url, status")
      .eq("post_id", post_id)
      .order("slide_n");
    if (sErr) throw sErr;

    const ready = (slides ?? []).filter((s) => s.final_png_url && s.status === "ready");
    if (ready.length === 0) throw new Error("Nenhuma slide pronta para publicar");

    await admin.from("imagery_posts").update({ ig_status: "publishing", ig_caption: caption, ig_error: null }).eq("id", post_id);

    let creationId: string;

    if (ready.length === 1) {
      // Imagem única
      const r = await igFetch(`/${IG_USER_ID}/media`, {
        image_url: ready[0].final_png_url!,
        caption,
        access_token: TOKEN,
      });
      creationId = r.id;
      await waitForContainer(creationId, TOKEN);
    } else {
      // Carrossel: cria container de cada item, depois um carousel container
      const childIds: string[] = [];
      for (const s of ready) {
        const c = await igFetch(`/${IG_USER_ID}/media`, {
          image_url: s.final_png_url!,
          is_carousel_item: "true",
          access_token: TOKEN,
        });
        childIds.push(c.id);
      }
      // Aguarda todos os filhos
      for (const id of childIds) await waitForContainer(id, TOKEN);

      const carousel = await igFetch(`/${IG_USER_ID}/media`, {
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
        access_token: TOKEN,
      });
      creationId = carousel.id;
      await waitForContainer(creationId, TOKEN);
    }

    // Publica
    const pub = await igFetch(`/${IG_USER_ID}/media_publish`, {
      creation_id: creationId,
      access_token: TOKEN,
    });

    // Busca permalink
    let permalink: string | null = null;
    try {
      const meta = await igFetch(`/${pub.id}`, { fields: "permalink", access_token: TOKEN }, "GET");
      permalink = meta.permalink ?? null;
    } catch (_) { /* ignore */ }

    await admin.from("imagery_posts").update({
      ig_status: "published",
      ig_media_id: pub.id,
      ig_permalink: permalink,
      ig_published_at: new Date().toISOString(),
    }).eq("id", post_id);

    return new Response(JSON.stringify({ success: true, media_id: pub.id, permalink }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("publish-instagram error:", msg);
    try {
      const { post_id } = await req.clone().json().catch(() => ({}));
      if (post_id) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("imagery_posts").update({ ig_status: "failed", ig_error: msg }).eq("id", post_id);
      }
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});