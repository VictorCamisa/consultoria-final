// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

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

export async function resolveInstanceForResponsavel({
  supabase,
  responsavel,
  logPrefix,
}: {
  supabase: SupabaseClient;
  responsavel: string;
  logPrefix: string;
}) {
  // 1. Busca vs_users pelo role do responsável
  const { data: responsibleUser } = await supabase
    .from("vs_users")
    .select("id, email")
    .eq("role", responsavel)
    .maybeSingle();

  // 2. Tenta pela vs_users.id (Victor, cujo vs_users.id === auth.uid)
  const legacyInstance = await findOpenInstanceByOwnerId(
    supabase,
    responsibleUser?.id,
  );
  if (legacyInstance) {
    console.log(`[${logPrefix}] Instância por vs_users.id "${responsavel}": ${legacyInstance}`);
    return legacyInstance;
  }

  // 3. Busca auth user pelo email e tenta pelo auth.uid (Danilo, cujo created_by é auth.uid)
  if (responsibleUser?.email) {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (!authErr && authData?.users) {
      const authUser = authData.users.find(
        (u: { email?: string }) => u.email?.toLowerCase() === responsibleUser.email.toLowerCase()
      );
      if (authUser) {
        const authInstance = await findOpenInstanceByOwnerId(supabase, authUser.id);
        if (authInstance) {
          console.log(`[${logPrefix}] Instância por auth.uid "${responsavel}": ${authInstance}`);
          return authInstance;
        }
      }
    }
  }

  return null;
}