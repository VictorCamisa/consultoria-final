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

async function resolveInstanceByUserId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: inst } = await supabase
    .from("evolution_instances").select("instance_name")
    .eq("created_by", userId).eq("state", "open").limit(1).maybeSingle();
  return (inst?.instance_name as string | undefined) ?? null;
}

async function resolveInstanceByResponsavel(supabase: ReturnType<typeof createClient>, responsavel: string) {
  const { data: vsUser } = await supabase
    .from("vs_users").select("id, email").eq("role", responsavel).maybeSingle();
  if (vsUser) {
    const { data: inst } = await supabase
      .from("evolution_instances").select("instance_name")
      .eq("created_by", vsUser.id).eq("state", "open").limit(1).maybeSingle();
    if (inst) return inst.instance_name as string;
    if (vsUser.email) {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const authUser = authData?.users?.find((u: any) => u.email?.toLowerCase() === vsUser.email.toLowerCase());
      if (authUser) {
        const { data: inst2 } = await supabase
          .from("evolution_instances").select("instance_name")
          .eq("created_by", authUser.id).eq("state", "open").limit(1).maybeSingle();
        if (inst2) return inst2.instance_name as string;
      }
    }
  }
  return null;
}

async function getAuthenticatedUserId(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

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
    const authUserId = await getAuthenticatedUserId(req);

    // Busca prospect
    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, nicho, status, responsavel")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    let instancia: string | null = null;

    if (authUserId) {
      instancia = await resolveInstanceByUserId(supabase, authUserId);
      if (!instancia) {
        throw new Error("Nenhuma instância Evolution conectada para seu usuário. Vá em Configurações > WhatsApp e conecte sua instância.");
      }
    } else {
      instancia = await resolveInstanceByResponsavel(supabase, prospect.responsavel ?? "danilo");

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
