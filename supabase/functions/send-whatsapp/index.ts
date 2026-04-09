/**
 * Envia mensagem via Evolution API e salva em consultoria_conversas.
 * Usa helper centralizado para resolução de instância.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, resolveSendInstance } from "../_shared/instance-resolver.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prospect_id, mensagem } = await req.json();
    if (!prospect_id || !mensagem) {
      throw new Error("prospect_id e mensagem são obrigatórios");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca prospect
    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, nicho, status, responsavel, linked_instance")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    // Resolve instância via helper centralizado
    const instancia = await resolveSendInstance(supabase, prospect);
    if (!instancia) {
      throw new Error("Nenhuma instância Evolution disponível. Vá em Configurações > WhatsApp.");
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      throw new Error("EVOLUTION_API_URL e EVOLUTION_API_KEY não configurados");
    }

    const phone = normalizePhone(prospect.whatsapp);

    // Envia mensagem via Evolution API v2
    const evoRes = await fetch(
      `${evolutionUrl}/message/sendText/${instancia}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({ number: phone, text: mensagem }),
      }
    );

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      throw new Error(`Evolution API error (${evoRes.status}): ${errText}`);
    }

    const evoData = await evoRes.json();
    const messageId = evoData?.key?.id ?? null;

    // Salva mensagem enviada no histórico
    const now = new Date().toISOString();
    const { error: insertErr } = await supabase
      .from("consultoria_conversas")
      .insert({
        prospect_id,
        direcao: "saida",
        conteudo: mensagem,
        message_id: messageId,
        processado_ia: false,
        origem: "system_send",
        instance_name: instancia,
      });
    if (insertErr) throw insertErr;

    // Atualiza data_ultima_interacao
    await supabase
      .from("consultoria_prospects")
      .update({ data_ultima_interacao: now, updated_at: now })
      .eq("id", prospect_id);

    return new Response(
      JSON.stringify({ success: true, message_id: messageId, instance: instancia }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
