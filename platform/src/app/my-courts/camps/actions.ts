"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { sendRegistrationStaffAlert } from "@/lib/registration-notifications";
import { effectiveEntitlements } from "@/lib/entitlements";

/// Same "does this athlete's active membership carry a member_pricing (or
/// class_credit) entitlement for this program" check used for per-session
/// bookings (lib/programs/pricing.ts) — camps read off the same
/// PlanEntitlement rows rather than a second, possibly-diverging notion of
/// "member" for whole-camp registration.
async function hasMemberPricing(athleteId: string, programId: string): Promise<boolean> {
  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId, status: "active" },
    include: { plan: { include: { entitlements: true, entitlementsFromPlan: { include: { entitlements: true } } } } },
  });
  return memberships.some((m) =>
    effectiveEntitlements(m.plan).some(
      (e) => (e.benefitType === "member_pricing" || e.benefitType === "class_credit") && (e.programId === null || e.programId === programId)
    )
  );
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

/// Whole-camp registration — a family registers once for the camp, not once
/// per session. Two shapes, matching Offering.registrationMode: "offering"
/// (one fixed price, the whole camp or nothing) and "multi_day" (the full
/// price for every day, or the single-day price for exactly one — the
/// RegistrationSelection enum only supports those two, not an arbitrary
/// subset of days, which matches how every camp here is actually priced:
/// there's no "2 of 4 days" rate, only "full week" or "one day").
export async function startCampRegistration(formData: FormData) {
  const athleteId = String(formData.get("athleteId") ?? "");
  const offeringId = String(formData.get("offeringId") ?? "");
  const dayChoice = String(formData.get("dayChoice") ?? "full"); // "full" or a sessionId

  const guardian = await getCurrentGuardian();
  const athlete = guardian.families
    .flatMap((fg) => fg.family.athletes)
    .find((a) => a.id === athleteId);
  if (!athlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { sessions: { orderBy: { startTime: "asc" } } },
  });
  if (offering.registrationMode !== "offering" && offering.registrationMode !== "multi_day") {
    throw new Error("This offering isn't a whole-camp registration.");
  }
  if (offering.status !== "published") {
    throw new Error("This camp isn't open for registration.");
  }

  const unsigned = await getUnsignedRequiredWaivers(guardian.id, athleteId);
  if (unsigned.length > 0) {
    redirect(`/my-courts/waivers?required=camps&back=${encodeURIComponent("/my-courts/camps")}`);
  }

  if (offering.registrationMode === "multi_day" && dayChoice !== "full" && !offering.allowSingleDay) {
    throw new Error("This camp doesn't offer single-day registration.");
  }
  const singleDay =
    offering.registrationMode === "multi_day" && dayChoice !== "full"
      ? offering.sessions.find((s) => s.id === dayChoice)
      : null;
  if (offering.registrationMode === "multi_day" && dayChoice !== "full" && !singleDay) {
    throw new Error("Pick a valid day.");
  }

  const selection = singleDay ? "single_day" : "all_sessions";
  // Member pricing only ever applies to the whole-camp price — a single day
  // of a multi_day camp has no separate member rate configured (Fall Break's
  // own pricing intentionally has no member discount at all), so a member
  // booking a single day still pays the plain single-day rate.
  const isMember = singleDay ? false : await hasMemberPricing(athleteId, offering.programId);
  const amountCents = singleDay
    ? (offering.singleDayPriceCents ?? offering.priceCents)
    : isMember && offering.memberPriceCents != null
      ? offering.memberPriceCents
      : offering.priceCents;
  if (amountCents == null) {
    throw new Error("This camp isn't priced yet.");
  }

  const registration = await prisma.registration.upsert({
    where: { offeringId_athleteId: { offeringId, athleteId } },
    create: {
      offeringId,
      athleteId,
      selection,
      selectedSessionId: singleDay?.id ?? null,
      status: "started",
      paymentStatus: "pending",
      amountCents,
    },
    update: {
      selection,
      selectedSessionId: singleDay?.id ?? null,
      status: "started",
      paymentStatus: "pending",
      amountCents,
    },
  });

  const origin = await getOrigin();
  let checkoutUrl: string;
  try {
    const customerId = await getOrCreateStripeCustomer(guardian);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      payment_method_types: ["us_bank_account", "card"],
      line_items: [
        {
          price_data: offering.stripeProductId
            ? { currency: "usd", unit_amount: amountCents, product: offering.stripeProductId }
            : { currency: "usd", unit_amount: amountCents, product_data: { name: offering.name } },
          quantity: 1,
        },
      ],
      success_url: `${origin}/my-courts/camps?checkout=success`,
      cancel_url: `${origin}/my-courts/camps?checkout=cancelled`,
      metadata: { registrationId: registration.id, athleteId, guardianId: guardian.id },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    checkoutUrl = session.url;
  } catch (err) {
    console.error("startCampRegistration failed", { athleteId, offeringId }, err);
    await sendRegistrationStaffAlert(registration.id).catch(() => {});
    redirect("/my-courts/camps?checkout=error");
  }

  redirect(checkoutUrl);
}

/// Withdraws a not-yet-paid registration — camps never refund once paid
/// (same policy as League), so this only clears an abandoned/started one.
export async function cancelCampRegistration(formData: FormData) {
  const athleteId = String(formData.get("athleteId") ?? "");
  const offeringId = String(formData.get("offeringId") ?? "");

  const guardian = await getCurrentGuardian();
  const ownsAthlete = guardian.families.some((fg) => fg.family.athletes.some((a) => a.id === athleteId));
  if (!ownsAthlete) throw new Error("Not authorized to act on this athlete.");

  await prisma.registration.updateMany({
    where: { offeringId, athleteId, status: { not: "cancelled" }, paymentStatus: { not: "paid" } },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
}
