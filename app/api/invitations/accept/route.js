import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * POST /api/invitations/accept  body: { token, password }
 *
 * Activates an invited account entirely server-side:
 *  1. Atomically CLAIM the invite (set accepted_at) only if it is unaccepted,
 *     unrevoked, and unexpired — this is the single-use guard and is race-safe
 *     (a conditional UPDATE … RETURNING; a second attempt claims nothing).
 *  2. Create the auth user with the invite's OWN email (never an email supplied
 *     by the browser) and email_confirm=true (the invite link proves control of
 *     that mailbox).
 *  3. If user creation fails, release the claim so the invite can be retried.
 *
 * The raw token is never stored (only its SHA-256). The service-role key stays
 * server-side. A 256-bit token makes guessing infeasible; a courtesy rate limit
 * throttles abuse (see lib/rateLimit.js for its limitation).
 */
export async function POST(request) {
  const ip = clientIp(request);
  if (!rateLimit(`inv-accept:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Cloud is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (token.length < 20) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = getAdminClient();
  const nowIso = new Date().toISOString();

  // 1) Atomic single-use claim.
  const { data: claimed, error: claimErr } = await admin
    .from("invitations")
    .update({ accepted_at: nowIso })
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id, email")
    .maybeSingle();

  if (claimErr || !claimed) {
    return NextResponse.json(
      { error: "This invitation is invalid, expired, or already used." },
      { status: 400 }
    );
  }

  // 2) Create the invited user (server-side; email comes from the invite).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: claimed.email,
    password,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    // 3) Release the claim so a legitimate invitee can retry.
    await admin.from("invitations").update({ accepted_at: null }).eq("id", claimed.id);
    const already = /registered|exists/i.test(createErr?.message || "");
    return NextResponse.json(
      { error: already ? "An account already exists for this email." : "Could not create the account." },
      { status: 400 }
    );
  }

  // Finalize: record who accepted.
  await admin
    .from("invitations")
    .update({ accepted_by: created.user.id, accepted_at: nowIso })
    .eq("id", claimed.id);

  // Return the email so the client can sign in; never return tokens/secrets.
  return NextResponse.json({ ok: true, email: claimed.email });
}
