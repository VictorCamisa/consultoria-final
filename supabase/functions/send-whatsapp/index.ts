/**
 * Envia mensagem via Evolution API e salva em consultoria_conversas.
 *
 * Variáveis de ambiente (Supabase Secrets):
 *   EVOLUTION_API_URL  - ex: https://evolution.seudominio.com.br
 *   EVOLUTION_API_KEY  - API key global da Evolution
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
      .select("id, whatsapp, nicho, status, responsavel")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    // Resolve instância pelo responsável do prospect
    let instancia: string | null = null;
    const realResponsavel = prospect.responsavel ?? "danilo";

    // Busca user_id do responsável
    const { data: vsUser } = await supabase
      .from("vs_users")
      .select("id")
      .eq("role", realResponsavel)
      .maybeSingle();

    if (vsUser) {
      const { data: userInstance } = await supabase
        .from("evolution_instances")
        .select("instance_name")
        .eq("created_by", vsUser.id)
        .eq("state", "open")
        .limit(1)
        .maybeSingle();
      if (userInstance) {
        instancia = userInstance.instance_name;
      }
    }

    // Fallback: config do nicho → qualquer config
    if (!instancia) {
      const { data: exactConfig } = await supabase
        .from("consultoria_config")
        .select("instancia_evolution")
        .eq("nicho", prospect.nicho)
        .maybeSingle();
      if (exactConfig?.instancia_evolution) {
        instancia = exactConfig.instancia_evolution;
      } else {
        const { data: allConfigs } = await supabase
          .from("consultoria_config")
          .select("instancia_evolution, nicho");
        if (allConfigs?.length) {
          const match = allConfigs.find((c: any) => c.instancia_evolution);
          instancia = match?.instancia_evolution ?? null;
        }
      }
    }
    if (!instancia) {
      throw new Error("Nenhuma instância Evolution configurada. Vá em Configurações > WhatsApp.");
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      throw new Error(
        "EVOLUTION_API_URL e EVOLUTION_API_KEY não configurados"
      );
    }

    // Normaliza número: garante formato com DDI 55
    const rawPhone = prospect.whatsapp.replace(/\D/g, "");
    const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

    // Envia mensagem via Evolution API v2
    const evoRes = await fetch(
      `${evolutionUrl}/message/sendText/${instancia}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: phone,
          text: mensagem,
        }),
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
      });
    if (insertErr) throw insertErr;

    // Atualiza data_ultima_interacao
    await supabase
      .from("consultoria_prospects")
      .update({ data_ultima_interacao: now, updated_at: now })
      .eq("id", prospect_id);

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
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
