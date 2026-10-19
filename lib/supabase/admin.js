import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase admin client (service-role). NEVER import this from a
 * client component or anything bundled to the browser — the service-role key
 * bypasses RLS. It is used only inside Route Handlers / server scripts for the
 * invite-accept flow (validate a token, create the invited user).
 *
 * The key comes from SUPABASE_SERVICE_ROLE_KEY — a plain (non-NEXT_PUBLIC) env
 * var, so it is never exposed to the client bundle. No session is persisted.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isAdminConfigured() {
  return Boolean(url && serviceKey);
}

let _admin = null;

export function getAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("getAdminClient() is server-only and must never run in the browser.");
  }
  if (!isAdminConfigured()) return null;
  if (!_admin) {
    _admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
