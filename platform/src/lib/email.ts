import "server-only";
import { Resend } from "resend";

// Transactional email — currently just the "you have a reply" nudge for the
// portal messaging system. The portal is always the system of record; email
// is a notification layer only, so a failure here must never break the
// staff-reply flow it's attached to. Every call site should treat this as
// best-effort and swallow errors.
//
// Requires RESEND_API_KEY (and a verified playthecourts.com sending domain
// in the Resend dashboard) to actually deliver. Without it, this logs and
// no-ops rather than throwing, so local dev and any environment that hasn't
// configured the key yet keep working.

const FROM = "The Courts <hello@playthecourts.com>";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(params: { to: string; subject: string; html: string; text: string }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. Would have sent "${params.subject}" to ${params.to}.`
    );
    return { ok: false as const, reason: "not_configured" as const };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error("[email] Resend rejected the send:", error);
      return { ok: false as const, reason: "send_failed" as const };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("[email] send threw:", err);
    return { ok: false as const, reason: "send_failed" as const };
  }
}
