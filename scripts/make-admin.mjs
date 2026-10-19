#!/usr/bin/env node
/**
 * Explicit initial-owner / admin setup (Phase 3).
 *
 * Usage:
 *   node scripts/make-admin.mjs owner@example.com          # promote to admin
 *   node scripts/make-admin.mjs owner@example.com --remove # demote to user
 *
 * This is the ONLY out-of-band way to create the first admin — the app never
 * auto-promotes anyone (not even the first registered user). The target must
 * already have an account (and therefore a profiles row created by the signup
 * trigger). Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in
 * .env.local (read locally; never printed).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* fall back to process.env */ }
  return { ...env, ...process.env };
}

async function main() {
  const email = process.argv[2];
  const remove = process.argv.includes("--remove");
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/make-admin.mjs <email> [--remove]");
    process.exit(1);
  }

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const role = remove ? "user" : "admin";

  const { data, error } = await admin
    .from("profiles")
    .update({ role })
    .ilike("email", email)
    .select("id, email, role");

  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error(`No account found for ${email}. They must sign up / accept an invite first.`);
    process.exit(1);
  }
  console.log(`\n✅ ${data[0].email} is now role="${data[0].role}".\n`);
}

main();
