/**
 * Webhook do Mercado Pago — recebe notificações de pagamento e atualiza
 * o status da cobrança correspondente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MP_API = "https://api.mercadopago.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADO_PAGO_ACCESS_TOKEN ausente");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const topic = body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic");
    const id = body?.data?.id || url.searchParams.get("id") || url.searchParams.get("data.id");

    if (topic !== "payment" || !id) {
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(`${MP_API}/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    if (!r.ok) throw new Error(`MP payment fetch ${r.status}`);
    const pay = await r.json();

    const prefId: string | undefined = pay.order?.id ? undefined : pay.preference_id;
    const externalRef: string = pay.external_reference || "";
    const status: string = pay.status;

    const map: Record<string, string> = {
      approved: "pago",
      pending: "pendente",
      in_process: "pendente",
      rejected: "rejeitado",
      cancelled: "cancelado",
      refunded: "reembolsado",
    };

    let query = supabase.from("consultoria_cobrancas").update({
      status: map[status] ?? status,
      mp_payment_id: String(pay.id),
      pago_em: status === "approved" ? new Date().toISOString() : null,
    });

    if (prefId) {
      query = query.eq("mp_preference_id", prefId);
    } else if (externalRef.startsWith("cliente:")) {
      const cid = externalRef.split(":")[1];
      query = query.eq("cliente_id", cid).eq("status", "pendente");
    }

    const { error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200, // MP exige 2xx para não reenviar indefinidamente
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
