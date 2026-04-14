/**
 * Busca a foto de perfil do WhatsApp de um contato via Evolution API.
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
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id é obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prospect, error: pErr } = await supabase
      .from("consultoria_prospects")
      .select("id, whatsapp, linked_instance")
      .eq("id", prospect_id)
      .single();
    if (pErr) throw pErr;

    const instancia = await resolveSendInstance(supabase, prospect);
    if (!instancia) {
      return new Response(
        JSON.stringify({ photo_url: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return new Response(
        JSON.stringify({ photo_url: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(prospect.whatsapp);

    const evoRes = await fetch(
      `${evolutionUrl}/chat/fetchProfilePictureUrl/${instancia}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({ number: phone }),
      }
    );

    if (!evoRes.ok) {
      // Some contacts don't have profile photos - not an error
      return new Response(
        JSON.stringify({ photo_url: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await evoRes.json();
    const photoUrl = data?.profilePictureUrl ?? data?.picture ?? data?.url ?? null;

    return new Response(
      JSON.stringify({ photo_url: photoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ photo_url: null, error: (err as Error).message }),
      {
        status: 200, // Don't fail the UI for missing photos
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
