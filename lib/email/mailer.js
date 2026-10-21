import nodemailer from "nodemailer";

/**
 * SERVER-ONLY email sender for app-generated messages — currently the invitation
 * email, whose link uses our own single-use token and therefore cannot be sent
 * by Supabase's built-in mailer. Transport is SMTP via the configured provider
 * (Gmail by default, same credentials as the Supabase custom SMTP). Configure in
 * the SERVER environment only (never a NEXT_PUBLIC_* var, never the client bundle):
 *
 *   EMAIL_APP_PASSWORD  (required)  the SMTP / Gmail App Password
 *   EMAIL_SMTP_HOST     (optional)  default "smtp.gmail.com"
 *   EMAIL_SMTP_PORT     (optional)  default 465 (implicit TLS); use 587 for STARTTLS
 *   EMAIL_SMTP_USER     (optional)  default "faizan.shaikh@atlasuniversity.edu.in"
 *   EMAIL_FROM          (optional)  default "ATLAS Creative Hub <EMAIL_SMTP_USER>"
 *
 * Nothing here ever logs the password or the invitation URL/token.
 */

const HOST = process.env.EMAIL_SMTP_HOST || "smtp.gmail.com";
const PORT = Number(process.env.EMAIL_SMTP_PORT || 465);
const USER = process.env.EMAIL_SMTP_USER || "faizan.shaikh@atlasuniversity.edu.in";
const PASS = process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_SMTP_PASS || "";
const FROM = process.env.EMAIL_FROM || `ATLAS Creative Hub <${USER}>`;

/** Whether a sending credential is present. When false, callers must not claim a send. */
export function isEmailConfigured() {
  return Boolean(PASS);
}

let _transport = null;
function getTransport() {
  if (typeof window !== "undefined") throw new Error("mailer is server-only");
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: USER, pass: PASS },
    });
  }
  return _transport;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function fmtExpiry(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

/**
 * Build the branded invitation message (pure — no network, no secrets). Exported
 * so message composition can be verified in isolation.
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildInvitationMessage({ to, inviteUrl, expiresAt }) {
  const expiry = fmtExpiry(expiresAt);
  const safeTo = escapeHtml(to);
  const safeUrl = escapeHtml(inviteUrl);
  const safeExpiry = escapeHtml(expiry);

  const subject = "You're invited to ATLAS Creative Hub";
  const text = [
    "You're invited to ATLAS Creative Hub.",
    "",
    `This invitation is for: ${to}`,
    "",
    "Accept your invitation and create your password:",
    inviteUrl,
    "",
    expiry ? `This link expires on ${expiry}.` : "",
    "",
    "You'll set your own password, then you can sign in right away.",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#4f46e5;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700;">ATLAS Creative Hub</td></tr>
      <tr><td style="padding:24px;color:#0f172a;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:600;">You're invited 🎉</p>
        <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
          You've been invited to join ATLAS Creative Hub. This invitation is for
          <strong>${safeTo}</strong>. Set your own password to get started.
        </p>
        <p style="margin:0 0 20px;">
          <a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Accept invitation &amp; create password</a>
        </p>
        ${safeExpiry ? `<p style="margin:0 0 12px;font-size:12px;color:#64748b;">This invitation expires on <strong>${safeExpiry}</strong>.</p>` : ""}
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">You'll set your own password, then you can sign in right away. If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#4f46e5;">${safeUrl}</span></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { subject, text, html };
}

/**
 * Send the branded invitation email containing the acceptance link.
 * Best-effort and failure-aware: the caller keeps the link visible regardless,
 * and a provider error is reported as { sent:false } — never a false success.
 * @returns {Promise<{ sent: boolean, reason?: string, detail?: string, messageId?: string }>}
 */
export async function sendInvitationEmail({ to, inviteUrl, expiresAt }) {
  if (!isEmailConfigured()) return { sent: false, reason: "not_configured" };

  const { subject, text, html } = buildInvitationMessage({ to, inviteUrl, expiresAt });

  try {
    const info = await getTransport().sendMail({ from: FROM, to, subject, text, html });
    return { sent: true, messageId: info?.messageId };
  } catch (e) {
    // The SMTP error text (no token/URL/password) is safe to surface for debugging.
    return { sent: false, reason: "send_failed", detail: e?.message || "send failed" };
  }
}
