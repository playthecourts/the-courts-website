import "server-only";
import { prisma } from "@/lib/prisma";
import { createDeskPaymentLink } from "@/lib/booking";
import { sendEmail } from "@/lib/email";

// Payment is online only at The Courts, so any seat booked with a balance
// (a staff-added athlete or walk-in with no plan covering the class) is paid
// through a Stripe link the family receives by email. Shared by the Payments
// page's "Email to Parent" and the automatic send when staff add someone.

const esc = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailLinkResult =
  | { sent: true; to: string; url: string }
  | { sent: false; reason: "no_email" | "email_not_configured" | "email_failed"; url: string };

/** Makes (or reuses) the booking's payment link and emails it to the primary parent. */
export async function emailPaymentLink(bookingId: string): Promise<EmailLinkResult> {
  const { url, email: to } = await createDeskPaymentLink(bookingId);
  if (!to) return { sent: false, reason: "no_email", url };

  const b = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      priceChargedCents: true,
      athlete: { select: { firstName: true, nickname: true } },
      session: { select: { title: true, offering: { select: { name: true } }, program: { select: { name: true } } } },
    },
  });
  const what = b.session.title ?? b.session.offering?.name ?? b.session.program.name;
  const kid = b.athlete.nickname?.trim() || b.athlete.firstName;
  const amount = `$${((b.priceChargedCents ?? 0) / 100).toFixed(2)}`;

  const res = await sendEmail({
    to,
    subject: `Your balance for ${kid}'s ${what}`,
    text: `Hi! ${kid}'s ${what} has a balance of ${amount}. You can pay securely here: ${url}\n\nThis link works for 23 hours. Questions? Just reply.\n\nThe Courts`,
    html: `<p>Hi!</p><p>${esc(kid)}'s <strong>${esc(what)}</strong> has a balance of <strong>${amount}</strong>.</p><p><a href="${esc(url)}">Pay securely here</a></p><p>This link works for 23 hours. Questions? Just reply.</p><p>The Courts</p>`,
  });
  if (res.ok) return { sent: true, to, url };
  return { sent: false, reason: res.reason === "not_configured" ? "email_not_configured" : "email_failed", url };
}

/**
 * Best-effort automatic send right after staff book someone with a balance.
 * Never throws: the booking already happened, and a failed email must not
 * undo it or show an error over a successful add. Returns a short line for
 * the staff member saying what happened.
 */
export async function autoEmailPaymentLink(bookingId: string): Promise<string> {
  try {
    const r = await emailPaymentLink(bookingId);
    if (r.sent) return `Payment link emailed to ${r.to}.`;
    if (r.reason === "no_email") return "No parent email on file — send a payment link from Payments.";
    return "Couldn't email the payment link — send it from Payments.";
  } catch (err) {
    console.error("[payment-link] auto email failed", bookingId, err);
    return "Couldn't create the payment link — send it from Payments.";
  }
}
