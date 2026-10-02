"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/os/dal";
import { createDeskPaymentLink } from "@/lib/booking";
import { stripe } from "@/lib/stripe";
import { facilityToday } from "@/lib/facility-time";
import { sendEmail } from "@/lib/email";
import { auditLog } from "@/lib/audit";

export type PayResult = { ok: true; message: string; url?: string } | { ok: false; error: string };

const fail = (err: unknown): PayResult => ({ ok: false, error: err instanceof Error ? err.message : "That didn't work — try again." });

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/// The Courts takes payment online only — there's no cash or card at the desk.
/// So the one way to collect a balance is a Stripe payment link.
///
/// Makes a Stripe payment link for a booking that owes money, and emails it to
/// the family's primary parent when asked. The link is also returned so the
/// desk can copy it into a text.
export async function sendPaymentLink(bookingId: string, email: boolean): Promise<PayResult> {
  try {
    const actor = await requireCapability("payments.sendLink");
    const { url, email: to } = await createDeskPaymentLink(bookingId);

    let message = "Payment link ready — copy it into a text, or email it.";
    if (email) {
      if (!to) return { ok: true, url, message: "No email on file for this parent — copy the link instead." };
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
      message = res.ok ? `Emailed to ${to}.` : "Couldn't send the email — copy the link instead.";
    }
    await auditLog(actor.id, "send_payment_link", "booking", bookingId, { emailed: email });
    return { ok: true, url, message };
  } catch (err) {
    return fail(err);
  }
}

/// Moves a membership's next charge to a chosen date, for any family (the
/// NextGen page has its own copy for transfers). A Stripe trial ending on that
/// date with proration off: nothing is charged or credited now, the next
/// invoice lands on the chosen day, and it renews monthly from there.
export async function setMembershipBillingDate(membershipId: string, raw: string): Promise<PayResult> {
  try {
    const actor = await requireCapability("plans.manage");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: "Pick a date." };
    // Noon in Nolensville (17:00 UTC) so the charge lands on the chosen day
    // on either side of daylight saving.
    const when = new Date(`${raw}T17:00:00Z`);
    if (when.getTime() < Date.now() + 60 * 60 * 1000) return { ok: false, error: "The new billing date has to be in the future." };
    if (when.getTime() > Date.now() + 730 * 86_400_000) return { ok: false, error: "That date is too far out." };

    const m = await prisma.athleteMembership.findUnique({
      where: { id: membershipId },
      select: { stripeSubscriptionId: true, status: true, cancelAt: true, renewalDate: true },
    });
    if (!m?.stripeSubscriptionId) return { ok: false, error: "This membership isn't billed through Stripe." };
    // A past-due membership has an unpaid invoice; moving the date doesn't
    // clear it. That's a card update in Stripe, not a date change.
    if (m.status !== "active") return { ok: false, error: "Only active memberships can have their billing date moved." };
    // Past a scheduled cancellation, the family would get free time and never
    // be charged again.
    if (m.cancelAt && when >= m.cancelAt) return { ok: false, error: "This membership is set to cancel before that date." };
    // Stripe drafts the renewal invoice around the renewal itself; moving the
    // date on the day doesn't void it.
    if (m.renewalDate && m.renewalDate <= facilityToday()) return { ok: false, error: "This membership renews today — change it in Stripe." };

    const sub = await stripe.subscriptions.retrieve(m.stripeSubscriptionId);
    // Subscriptions on a schedule (NextGen transfers) can override a trial
    // date at a phase change — those move from the NextGen page.
    if (sub.schedule) return { ok: false, error: "This membership is on a billing schedule — move it from the NextGen page." };

    await stripe.subscriptions.update(m.stripeSubscriptionId, {
      trial_end: Math.floor(when.getTime() / 1000),
      proration_behavior: "none",
    });
    await prisma.athleteMembership.updateMany({
      where: { stripeSubscriptionId: m.stripeSubscriptionId },
      data: { renewalDate: when },
    });
    await auditLog(actor.id, "set_next_billing_date", "membership", membershipId, { subscription: m.stripeSubscriptionId, nextBilling: raw });

    revalidatePath("/os/payments");
    revalidatePath("/os/members");
    return { ok: true, message: `Next charge moved to ${raw}.` };
  } catch (err) {
    return fail(err);
  }
}
