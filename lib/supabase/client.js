"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client — created lazily and ONLY when the public env vars are
 * present. Cloud sync is optional; with no config the app stays fully
 * local-first (Dexie) and every cloud entry point is a no-op.
 *
 * Only the URL + anon key are used here (both safe in the browser; RLS protects
 * data). The service-role key must never reach client code.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

/** Returns the shared browser client, or null when cloud is not configured. */
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (typeof window === "undefined") return null; // never on the server
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // supports magic-link redirects
      },
    });
  }
  return _client;
}

/** Storage bucket name shared by the sync layer. */
export const DESIGNS_BUCKET = "designs";
