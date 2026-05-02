// Imagery Engine — Orchestrator (pipeline completo)
// Para cada slide com needs_image:
//   1. generate-image
//   2. validate-image
//   3. se decisao=retry, generate novamente (max 1 retry)
//   4. compose-slide
// Slides sem imagem vão direto para compose.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callFn(name: string, body: unknown, authHeader: string) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: resp.ok, status: resp.status, json, text };
}

async function processSlide(slideId: string, needsImage: boolean, authHeader: string, admin: any) {
  if (needsImage) {
    const gen1 = await callFn("imagery-generate-image", { slide_id: slideId }, authHeader);
    if (!gen1.ok) return { slideId, ok: false, step: "generate", error: gen1.text.slice(0, 200) };

    const val1 = await callFn("imagery-validate-image", { slide_id: slideId }, authHeader);
    if (!val1.ok) {
      // segue mesmo sem validação
      console.warn("validate falhou, seguindo:", val1.text.slice(0, 200));
    } else if (val1.json?.decisao === "retry") {
      // 1 retry
      await admin.from("imagery_slides").update({ retry_count: 1 }).eq("id", slideId);
      const gen2 = await callFn("imagery-generate-image", { slide_id: slideId }, authHeader);
      if (gen2.ok) {
        await callFn("imagery-validate-image", { slide_id: slideId }, authHeader);
      }
    }
  }

  const comp = await callFn("imagery-compose-slide", { slide_id: slideId }, authHeader);
  if (!comp.ok && comp.status !== 202) {
    return { slideId, ok: false, step: "compose", error: comp.text.slice(0, 200) };
  }
  // Poll status (compose runs in background, up to ~90s)
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data: s } = await admin.from("imagery_slides")
      .select("status, final_png_url, error_message").eq("id", slideId).single();
    if (s?.status === "ready") return { slideId, ok: true, final_url: s.final_png_url };
    if (s?.status === "failed") return { slideId, ok: false, step: "compose", error: s.error_message ?? "failed" };
  }
  return { slideId, ok: false, step: "compose", error: "timeout" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("imagery_posts").update({ status: "generating" }).eq("id", post_id);

    const { data: slides, error } = await admin.from("imagery_slides")
      .select("id, needs_image").eq("post_id", post_id).order("slide_n");
    if (error) throw error;

    const results = await Promise.allSettled(
      (slides ?? []).map((s: any) => processSlide(s.id, s.needs_image, authHeader, admin))
    );

    const ok = results.filter((r) => r.status === "fulfilled" && (r as any).value.ok).length;
    const failed = results.length - ok;

    const { data: logs } = await admin.from("imagery_logs")
      .select("custo_usd").eq("post_id", post_id);
    const total = (logs ?? []).reduce((acc: number, l: any) => acc + Number(l.custo_usd ?? 0), 0);

    await admin.from("imagery_posts").update({
      status: failed === 0 ? "ready" : (ok > 0 ? "ready" : "failed"),
      error_message: failed > 0 ? `${failed}/${results.length} slides com problema` : null,
      custo_total_usd: total,
    }).eq("id", post_id);

    return new Response(JSON.stringify({
      post_id, total: results.length, ok, failed, custo_total_usd: total,
      results: results.map((r) => r.status === "fulfilled" ? (r as any).value : { ok: false, error: (r as any).reason?.message }),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("imagery-orchestrate error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});