import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs"; // needs node:crypto + service-role client

/**
 * GET /api/invitations/validate?token=... → { valid, email? }
 * Read-only: tells the accept page whether a token is currently usable and which
 * email it is bound to. Returns only { valid:false } for anything invalid so it
 * never leaks which tokens exist.
 */
export async function GET(request) {
  const ip = clientIp(request);
  if (!rateLimit(`inv-validate:${ip}`, 30, 60_000)) {
    return NextResponse.json({ valid: false, error: "rate_limited" }, { status: 429 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ valid: false, error: "not_configured" }, { status: 200 });
  }

  const token = new URL(request.url).searchParams.get("token") || "";
  if (token.length < 20) return NextResponse.json({ valid: false });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const admin = getAdminClient();
  const { data } = await admin
    .from("invitations")
    .select("email, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !data ||
    data.accepted_at ||
    data.revoked_at ||
    new Date(data.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({ valid: true, email: data.email });
}
