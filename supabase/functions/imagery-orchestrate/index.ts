// Imagery Engine — Orchestrator (dispatcher assíncrono)
// A requisição HTTP só inicia a fila e retorna 202.
// O trabalho pesado roda em background para não estourar WORKER_RESOURCE_LIMIT.
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
  try { json = JSON.parse(text); } catch { json = null; }
  return { ok: resp.ok, status: resp.status, json, text };
}

async function processSlide(slideId: string, needsImage: boolean, authHeader: string, admin: any) {
  if (needsImage) {
    const gen1 = await callFn("imagery-generate-image", { slide_id: slideId }, authHeader);
    if (!gen1.ok) {
      await admin.from("imagery_slides").update({
        status: "failed",
        error_message: `generate: ${gen1.text.slice(0, 180)}`,
      }).eq("id", slideId);
      return { slideId, ok: false, step: "generate", error: gen1.text.slice(0, 200) };
    }

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
    await admin.from("imagery_slides").update({
      status: "failed",
      error_message: `compose: ${comp.text.slice(0, 180)}`,
    }).eq("id", slideId);
    return { slideId, ok: false, step: "compose", error: comp.text.slice(0, 200) };
  }
  return { slideId, ok: true, step: "compose", accepted: true };
}

async function finalizePostIfSettled(admin: any, postId: string) {
  const { data: slides } = await admin.from("imagery_slides")
    .select("status").eq("post_id", postId);
  const total = slides?.length ?? 0;
  if (!total || !slides!.every((s: any) => ["ready", "failed"].includes(s.status))) return;

  const failed = slides!.filter((s: any) => s.status === "failed").length;
  const { data: logs } = await admin.from("imagery_logs")
    .select("custo_usd").eq("post_id", postId);
  const custoTotal = (logs ?? []).reduce((acc: number, l: any) => acc + Number(l.custo_usd ?? 0), 0);

  await admin.from("imagery_posts").update({
    status: failed === total ? "failed" : "ready",
    error_message: failed > 0 ? `${failed}/${total} slides com problema` : null,
    custo_total_usd: custoTotal,
  }).eq("id", postId);
}

async function processPost(postId: string, authHeader: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const { data: slides, error } = await admin.from("imagery_slides")
      .select("id, needs_image, slide_n").eq("post_id", postId).order("slide_n");
    if (error) throw error;

    for (const slide of slides ?? []) {
      await admin.from("imagery_slides").update({
        status: "queued",
        error_message: null,
      }).eq("id", slide.id);
    }

    for (const slide of slides ?? []) {
      await processSlide(slide.id, slide.needs_image, authHeader, admin);
    }

    await finalizePostIfSettled(admin, postId);

    await admin.from("imagery_logs").insert({
      post_id: postId,
      step: "orchestrate",
      provider: "supabase-edge",
      model: "async-dispatcher",
      response_summary: { slides: slides?.length ?? 0, mode: "background" },
      success: true,
    });
  } catch (e: any) {
    console.error("processPost error:", e);
    await admin.from("imagery_posts").update({
      status: "failed",
      error_message: String(e?.message ?? e).slice(0, 500),
    }).eq("id", postId);
  }
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
    await admin.from("imagery_posts").update({ status: "generating", error_message: null }).eq("id", post_id);

    const { data: slides, error } = await admin.from("imagery_slides")
      .select("id, needs_image").eq("post_id", post_id).order("slide_n");
    if (error) throw error;

    for (const slide of slides ?? []) {
      await admin.from("imagery_slides").update({ status: "queued", error_message: null }).eq("id", slide.id);
    }

    // @ts-expect-error EdgeRuntime is provided at runtime
    EdgeRuntime.waitUntil(processPost(post_id, authHeader));

    return new Response(JSON.stringify({
      accepted: true,
      post_id,
      total: slides?.length ?? 0,
      message: "Pipeline iniciado em background",
    }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("imagery-orchestrate error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});