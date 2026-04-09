import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { email, password, name, role } = await req.json();

  // Create auth user
  const { data: userData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    return new Response(JSON.stringify({ error: authErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert into vs_users
  const { error: dbErr } = await admin.from("vs_users").insert({
    email,
    name: name || email.split("@")[0],
    role: role || "comercial",
  });

  return new Response(JSON.stringify({ user: userData.user?.id, db_error: dbErr?.message || null }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
