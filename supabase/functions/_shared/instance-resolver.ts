/**
 * Centralized WhatsApp instance resolution and phone normalization.
 * Used by: send-whatsapp, abordar-prospect, process-cadencia, sync-whatsapp-messages, whatsapp-webhook
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

/** Normalize phone to E.164-ish format: digits only, with 55 prefix */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/** Build remoteJid from phone */
export function phoneToJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

/** Build multiple JID candidates for matching */
export function buildJidCandidates(whatsapp: string): string[] {
  const digits = whatsapp.replace(/\D/g, "");
  const withDDI = digits.startsWith("55") ? digits : `55${digits}`;
  const withoutDDI = digits.startsWith("55") ? digits.slice(2) : digits;
  
  const set = new Set<string>();
  set.add(`${withDDI}@s.whatsapp.net`);
  set.add(`${digits}@s.whatsapp.net`);
  if (withoutDDI.length >= 10) set.add(`${withoutDDI}@s.whatsapp.net`);
  return Array.from(set);
}

/** Match prospect by phone number (for webhook) */
export function buildPhoneMatchFilter(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  const withDDI = digits.startsWith("55") ? digits : `55${digits}`;
  const withoutDDI = digits.startsWith("55") ? digits.slice(2) : digits;
  
  // Build OR filter for various phone formats
  const candidates = new Set<string>();
  candidates.add(digits);
  candidates.add(`+${withDDI}`);
  candidates.add(withDDI);
  if (withoutDDI !== digits) candidates.add(withoutDDI);
  // Also match with +55 prefix
  candidates.add(`+55${withoutDDI}`);
  
  return Array.from(candidates).map(p => `whatsapp.eq.${p}`).join(",");
}

/**
 * Resolve the sending instance for a prospect.
 * Priority:
 * 1. Prospect's linked_instance (if already bound)
 * 2. Responsável's instance (via vs_users → evolution_instances)
 * 3. Config's instance for the nicho
 * 4. Any open instance as last resort
 * 
 * Also persists the binding once resolved.
 */
export async function resolveSendInstance(
  supabase: SupabaseClient,
  prospect: { id: string; whatsapp: string; responsavel?: string | null; nicho?: string; linked_instance?: string | null },
): Promise<string | null> {
  // 1. Already linked
  if (prospect.linked_instance) {
    // Verify it's still open
    const { data: inst } = await supabase
      .from("evolution_instances").select("instance_name")
      .eq("instance_name", prospect.linked_instance).eq("state", "open").maybeSingle();
    if (inst) return prospect.linked_instance;
    // Instance no longer open, clear binding and continue resolution
  }

  let resolved: string | null = null;

  // 2. Responsável's instance
  const responsavel = prospect.responsavel ?? "danilo";
  resolved = await resolveInstanceByRole(supabase, responsavel);

  // 3. Config for nicho
  if (!resolved && prospect.nicho) {
    const { data: config } = await supabase
      .from("consultoria_config").select("instancia_evolution")
      .ilike("nicho", `%${prospect.nicho}%`).maybeSingle();
    if (config?.instancia_evolution) {
      // Verify open
      const { data: inst } = await supabase
        .from("evolution_instances").select("instance_name")
        .eq("instance_name", config.instancia_evolution).eq("state", "open").maybeSingle();
      if (inst) resolved = config.instancia_evolution;
    }
  }

  // 4. Any open instance
  if (!resolved) {
    const { data: anyInst } = await supabase
      .from("evolution_instances").select("instance_name")
      .eq("state", "open").limit(1).maybeSingle();
    if (anyInst) resolved = anyInst.instance_name;
  }

  // Persist binding
  if (resolved) {
    const jid = phoneToJid(prospect.whatsapp);
    await supabase.from("consultoria_prospects").update({
      linked_instance: resolved,
      remote_jid: jid,
    }).eq("id", prospect.id);
  }

  return resolved;
}

/**
 * Resolve instance by vs_users role.
 * Handles: vs_users.id → evolution_instances.created_by
 * Fallback: vs_users.email → auth.users.email → evolution_instances.created_by
 */
async function resolveInstanceByRole(supabase: SupabaseClient, role: string): Promise<string | null> {
  const { data: vsUser } = await supabase
    .from("vs_users").select("id, email").eq("role", role).maybeSingle();
  if (!vsUser) return null;

  // Direct match by vs_users.id
  const { data: inst } = await supabase
    .from("evolution_instances").select("instance_name")
    .eq("created_by", vsUser.id).eq("state", "open").limit(1).maybeSingle();
  if (inst) return inst.instance_name;

  // Fallback: match by email via auth.users
  if (vsUser.email) {
    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const authUser = authData?.users?.find((u: any) => u.email?.toLowerCase() === vsUser.email.toLowerCase());
    if (authUser) {
      const { data: inst2 } = await supabase
        .from("evolution_instances").select("instance_name")
        .eq("created_by", authUser.id).eq("state", "open").limit(1).maybeSingle();
      if (inst2) return inst2.instance_name;
    }
  }

  return null;
}

/**
 * Get ALL open instances for sync/reading purposes.
 */
export async function getAllOpenInstances(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("evolution_instances").select("instance_name")
    .eq("state", "open");
  return (data ?? []).map(i => i.instance_name).filter(Boolean);
}
