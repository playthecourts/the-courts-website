"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { auditLog } from "@/lib/audit";

/// A manual override with no matching historical record — distinct from
/// `linkNextGenRecord` (a real data match) so admin's table can see HOW
/// someone was confirmed. Same consequence either way: keeps the $165 rate,
/// no billing change. Never touches Stripe — a former_nextgen guardian
/// already self-served checkout at signup with their price already known.
export async function approveAsFounderAnyway(guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus === null) {
    throw new Error("This guardian never self-reported a NextGen status.");
  }

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenVerification: "admin_approved", isFounder: true },
  });

  await auditLog(actor.id, "verify_nextgen_founder", "guardian", guardianId, { via: "admin_approved" });
  revalidatePath("/os/nextgen");
}

/// Free-text reminder for "we're still waiting to hear back" — no enum
/// change, no billing consequence. Just keeps the follow-up visible in the
/// admin table instead of living in someone's head.
export async function requestMoreInfo(guardianId: string, formData: FormData) {
  const actor = await requireCapability("nextgen.verify");
  const note = String(formData.get("note") ?? "").trim();

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenNotes: note || null },
  });

  await auditLog(actor.id, "set_nextgen_legacy_rate", "guardian", guardianId, { note, action: "request_more_info" });
  revalidatePath("/os/nextgen");
}

/// The non-punitive outcome when Founder status genuinely can't be
/// confirmed: never cancels, never refunds, never charges the difference
/// immediately. proration_behavior: "none" on a mid-cycle price swap is the
/// same idiom already used for Oct-1 billing_cycle_anchor elsewhere in this
/// codebase, applied here to a downgrade instead of a start date — the
/// current paid period is untouched, only the NEXT invoice reflects the new
/// price. Works for either a Founders ($165 fixed) or NextGen Legacy Rate
/// (ad-hoc-priced) subscription — whichever this guardian actually has.
/// Shared by moveToUnlimited (former_nextgen, usually already subscribed)
/// and denyLegacyRate (current_nextgen, usually pre-checkout): if a real
/// paid subscription exists on the Founders/Legacy price, swap it to
/// Unlimited with no proration — the current paid period is untouched, only
/// the next invoice reflects the new price. If no subscription exists yet,
/// there's nothing in Stripe to touch.
async function switchGuardianToUnlimited(guardianId: string) {
  const membership = await prisma.athleteMembership.findFirst({
    where: {
      status: { in: ["active", "past_due"] },
      stripeSubscriptionId: { not: null },
      plan: { name: { in: ["Founders Membership", "NextGen Legacy Rate"] } },
      athlete: { family: { guardians: { some: { guardianId } } } },
    },
  });
  if (!membership?.stripeSubscriptionId) return false;

  const unlimitedPlan = await prisma.membershipPlan.findFirstOrThrow({ where: { name: "Unlimited Membership" } });
  if (!unlimitedPlan.stripePriceId) {
    throw new Error("Unlimited Membership has no Stripe price configured.");
  }

  const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("Couldn't find the billed item on this subscription.");

  await stripe.subscriptions.update(membership.stripeSubscriptionId, {
    items: [{ id: itemId, price: unlimitedPlan.stripePriceId }],
    proration_behavior: "none",
  });
  await prisma.athleteMembership.update({
    where: { id: membership.id },
    data: { membershipPlanId: unlimitedPlan.id },
  });
  return true;
}

export async function moveToUnlimited(guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus === null) {
    throw new Error("This guardian never self-reported a NextGen status.");
  }

  const movedSubscription = await switchGuardianToUnlimited(guardianId);

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenVerification: "not_eligible" },
  });

  await auditLog(actor.id, "mark_nextgen_not_eligible", "guardian", guardianId, { movedSubscription });
  revalidatePath("/os/nextgen");
}

/// The "Deny" half of the approve/deny pair on a Current NextGen guardian's
/// proposed rate. Distinct from moveToUnlimited (worded for an already-
/// subscribed Founder) because most Current NextGen guardians haven't
/// checked out yet — there's usually nothing in Stripe to move, just a
/// proposed rate to clear so it doesn't linger in the "Rate $" field. If
/// they'd already subscribed on a Founders/Legacy price before being
/// denied, this still swaps them to Unlimited with no proration, same as
/// moveToUnlimited — never a refund or a claw-back.
export async function denyLegacyRate(guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus !== "current_nextgen") {
    throw new Error("This guardian isn't a current NextGen self-report.");
  }

  const movedSubscription = await switchGuardianToUnlimited(guardianId);

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenVerification: "not_eligible", legacyRateCents: null, isFounder: false },
  });

  await auditLog(actor.id, "mark_nextgen_not_eligible", "guardian", guardianId, {
    via: "deny_rate",
    movedSubscription,
  });
  revalidatePath("/os/nextgen");
}

/// Current-NextGen only. Sets the real legacy rate AND verifies in one
/// action — a "verified with no rate" intermediate state should never be
/// reachable. Does NOT create a Stripe subscription: this guardian has no
/// payment method on file (they skipped checkout at signup by design), so
/// this only unlocks startNextGenLegacyCheckout — the family must click it
/// and enter a card themselves. This is the manual-entry fallback for when
/// no NextGenRecord match exists — linkNextGenRecord below is preferred
/// whenever a real historical record can be found.
export async function setLegacyRate(guardianId: string, formData: FormData) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus !== "current_nextgen") {
    throw new Error("This guardian isn't a current NextGen self-report.");
  }

  const dollars = Number(formData.get("legacyRate"));
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error("Enter a valid monthly rate.");
  }
  const legacyRateCents = Math.round(dollars * 100);

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { legacyRateCents, nextGenVerification: "verified" },
  });

  await auditLog(actor.id, "set_nextgen_legacy_rate", "guardian", guardianId, { legacyRateCents });
  revalidatePath("/os/nextgen");
}

/// Confirms a Courts account belongs to a specific historical NextGen
/// record even when the emails differ — matching supports more than email
/// on purpose (see NextGenRecord), and this is the "yes, that's them" click
/// that turns a surfaced candidate into a permanent link. Once linked, the
/// guardian's legacy rate is set from the record and verification flips to
/// "verified" — per the business rule, they're never asked to re-verify.
export async function linkNextGenRecord(recordId: string, guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const [record, guardian] = await Promise.all([
    prisma.nextGenRecord.findUniqueOrThrow({ where: { id: recordId } }),
    prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } }),
  ]);
  if (guardian.nextGenStatus === null) {
    throw new Error("This guardian never self-reported a NextGen status.");
  }

  await prisma.$transaction([
    prisma.nextGenRecord.update({
      where: { id: recordId },
      data: { matchedGuardianId: guardianId, matchedAt: new Date() },
    }),
    prisma.guardian.update({
      where: { id: guardianId },
      data: {
        nextGenVerification: "verified",
        isFounder: true,
        ...(record.legacyRateCents != null ? { legacyRateCents: record.legacyRateCents } : {}),
      },
    }),
  ]);

  await auditLog(actor.id, "verify_nextgen_founder", "guardian", guardianId, { via: "linked_record", recordId });
  revalidatePath("/os/nextgen");
}

/// Undoes linkNextGenRecord: sends the record back to "Unmatched" and the
/// guardian back to unverified — the plain undo for a link made in error.
/// If a real paid subscription already exists on the linked price, it's
/// swapped to Unlimited with no proration (never a refund or claw-back),
/// same as denyLegacyRate/moveToUnlimited.
export async function unlinkNextGenRecord(recordId: string, guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const record = await prisma.nextGenRecord.findUniqueOrThrow({ where: { id: recordId } });
  if (record.matchedGuardianId !== guardianId) {
    throw new Error("This record isn't linked to that account.");
  }

  const movedSubscription = await switchGuardianToUnlimited(guardianId);

  await prisma.$transaction([
    prisma.nextGenRecord.update({ where: { id: recordId }, data: { matchedGuardianId: null, matchedAt: null } }),
    prisma.guardian.update({
      where: { id: guardianId },
      data: { nextGenVerification: "unverified", isFounder: false, legacyRateCents: null },
    }),
  ]);

  await auditLog(actor.id, "mark_nextgen_not_eligible", "guardian", guardianId, {
    via: "unlink_record",
    recordId,
    movedSubscription,
  });
  revalidatePath("/os/nextgen");
}

/// The "no" on a suggested candidate pairing, without linking or resolving
/// the record — it just stops that specific guardian from being suggested
/// again for this record. The record stays in "Unmatched" for other
/// candidates or a future import to catch.
export async function dismissNextGenCandidate(recordId: string, guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const record = await prisma.nextGenRecord.findUniqueOrThrow({ where: { id: recordId } });
  if (!record.rejectedGuardianIds.includes(guardianId)) {
    await prisma.nextGenRecord.update({
      where: { id: recordId },
      data: { rejectedGuardianIds: { push: guardianId } },
    });
  }

  await auditLog(actor.id, "set_nextgen_legacy_rate", "guardian", guardianId, {
    action: "dismiss_candidate",
    recordId,
  });
  revalidatePath("/os/nextgen");
}
