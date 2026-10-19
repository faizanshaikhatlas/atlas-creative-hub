#!/usr/bin/env node
/**
 * Mint an invitation (admin workflow for Phase 2).
 *
 * Usage:
 *   node scripts/create-invite.mjs someone@example.com [expiresInDays=7]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 * (read locally; never printed). Prints a one-time invite URL to share with the
 * invitee. The raw token is shown ONCE here and only its SHA-256 hash is stored.
 *
 * This CLI is the Phase 2 admin workflow (fits the architecture, no premature
 * admin UI). A role-gated in-app invite screen can follow once Phase 3 adds the
 * admin role.
 */
import crypto from "node:crypto";
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
  } catch {
    /* fall back to process.env below */
  }
  return { ...env, ...process.env };
}

async function main() {
  const email = process.argv[2];
  const days = Number(process.argv[3] || 7);
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/create-invite.mjs <email> [expiresInDays=7]");
    process.exit(1);
  }

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const site = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = crypto.randomBytes(32).toString("base64url"); // 256-bit
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("invitations").insert({
    email: email.toLowerCase(),
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("Failed to create invitation:", error.message);
    process.exit(1);
  }

  const inviteUrl = `${site.replace(/\/$/, "")}/invite/accept?token=${token}`;
  console.log("\n✅ Invitation created");
  console.log(`   Email:    ${email.toLowerCase()}`);
  console.log(`   Expires:  ${expiresAt} (${days} day(s))`);
  console.log(`   Send this one-time link to the invitee:\n`);
  console.log(`   ${inviteUrl}\n`);
}

main();
