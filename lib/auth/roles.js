import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side role resolution. The role is read from public.profiles (the
 * server-controlled source of truth), NEVER from anything the browser sends.
 * `getUser()` re-validates the session JWT with Supabase Auth first.
 */

export async function getSessionProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, role, status, provider, disabled")
    .eq("id", user.id)
    .maybeSingle();

  // Fallback if the profile row hasn't materialized yet (trigger lag): treat as
  // a brand-new, non-admin, NOT-yet-approved user. Never infer admin or approval.
  return (
    data || {
      id: user.id,
      email: user.email,
      role: "user",
      status: "pending",
      provider: "email",
      disabled: false,
    }
  );
}

/**
 * True when the profile may use the app's protected (cloud) features: an admin,
 * or an explicitly approved user, and never a disabled one. This mirrors the
 * database's is_active_member() so server checks and RLS agree.
 */
export function isActiveMember(p) {
  if (!p || p.disabled) return false;
  return p.role === "admin" || p.status === "approved";
}

/** Returns the admin profile, or null if the caller is not an active admin. */
export async function requireAdmin() {
  const p = await getSessionProfile();
  if (!p || p.disabled || p.role !== "admin") return null;
  return p;
}

/**
 * Returns the caller's profile only if they are an active member (approved or
 * admin, not disabled); otherwise null. Use to gate approval-sensitive server
 * work. The database RLS enforces the same rule independently (defense in depth).
 */
export async function requireApproved() {
  const p = await getSessionProfile();
  return isActiveMember(p) ? p : null;
}
