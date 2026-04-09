import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

async function findOpenInstanceByOwnerId(
  supabase: SupabaseClient,
  ownerId: string | null | undefined,
) {
  if (!ownerId) return null;

  const { data } = await supabase
    .from("evolution_instances")
    .select("instance_name")
    .eq("created_by", ownerId)
    .eq("state", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.instance_name ?? null;
}

async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    console.error(`[instance] Falha ao listar usuários auth: ${error.message}`);
    return null;
  }

  return (
    data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
      ?.id ?? null
  );
}

async function findRequestUser(
  authHeader: string | null,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!authHeader?.startsWith("Bearer ") || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error) {
    console.error(`[instance] Falha ao identificar usuário autenticado: ${error.message}`);
    return null;
  }

  return user;
}

export async function resolveInstanceForResponsavel({
  supabase,
  responsavel,
  authHeader,
  logPrefix,
}: {
  supabase: SupabaseClient;
  responsavel: string;
  authHeader?: string | null;
  logPrefix: string;
}) {
  const requestUser = await findRequestUser(authHeader ?? null);

  if (requestUser?.email) {
    const { data: currentVsUser } = await supabase
      .from("vs_users")
      .select("role")
      .ilike("email", requestUser.email)
      .maybeSingle();

    if (currentVsUser?.role === responsavel) {
      const currentUserInstance = await findOpenInstanceByOwnerId(
        supabase,
        requestUser.id,
      );

      if (currentUserInstance) {
        console.log(
          `[${logPrefix}] Usando instância do usuário autenticado "${responsavel}": ${currentUserInstance}`,
        );
        return currentUserInstance;
      }
    }
  }

  const { data: responsibleUser } = await supabase
    .from("vs_users")
    .select("id, email")
    .eq("role", responsavel)
    .maybeSingle();

  const legacyInstance = await findOpenInstanceByOwnerId(
    supabase,
    responsibleUser?.id,
  );

  if (legacyInstance) {
    console.log(
      `[${logPrefix}] Usando instância legada do responsável "${responsavel}": ${legacyInstance}`,
    );
    return legacyInstance;
  }

  if (responsibleUser?.email) {
    const authUserId = await findAuthUserIdByEmail(supabase, responsibleUser.email);
    const authOwnedInstance = await findOpenInstanceByOwnerId(supabase, authUserId);

    if (authOwnedInstance) {
      console.log(
        `[${logPrefix}] Usando instância auth do responsável "${responsavel}": ${authOwnedInstance}`,
      );
      return authOwnedInstance;
    }
  }

  return null;
}