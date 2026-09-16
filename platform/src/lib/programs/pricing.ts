import "server-only";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// What this costs THIS family, and how the payment is set up.
//
// Two rules shape everything here:
//
//   1. Stripe is the source of truth for payment objects. We store pointers
//      (product id, price id, tax code) and the amounts we display. We do not
//      reimplement Stripe's pricing, and we never store card data.
//
//   2. "Member" never silently means "free". Every Training Plan interaction is
//      an explicit CreditRule on the offering, and the booking screen states the
//      rule in words before a family commits.
// ---------------------------------------------------------------------------

import { entitlementPeriodBounds, effectiveEntitlements } from "@/lib/entitlements";
import type { BookingRule } from "./pricing-types";
export type { BookingRule };

/// The rule for one athlete booking one occurrence of one offering. This is the
/// single place that decides, and both the Parent App and the admin booking
/// screen render its result — so a parent and an admin always see the same
/// answer to "what does this cost?".
export async function resolveBookingRule(
  athleteId: string,
  offeringId: string,
  sessionStart: Date,
  /// What the FIRST non-cancelled booking on this specific session actually
  /// paid, or null if there isn't one — this athlete would be the first.
  /// When the offering has a companionPriceCents set and this isn't null,
  /// `companionPriceCents` is read as the FLAT TOTAL for both people
  /// together, not this person's own price: the companion is charged
  /// whatever's left of that total after the first booker's own charge, so
  /// e.g. Dr. Dish's real "$50 total, same for members and non-members"
  /// promise holds exactly regardless of which of the two is a member. This
  /// overrides full_price/member_price alike, same as before.
  firstBookingPriceCents: number | null = null
): Promise<BookingRule> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    select: {
      programId: true,
      priceCents: true,
      memberPriceCents: true,
      companionPriceCents: true,
      creditRule: true,
      creditsPerBooking: true,
      pricingModel: true,
      program: { select: { programType: true } },
    },
  });

  if (offering.pricingModel === "free" || offering.creditRule === "free") return { kind: "free" };

  const isCompanion = offering.companionPriceCents !== null && firstBookingPriceCents !== null;
  const companionChargeCents = isCompanion
    ? Math.max(0, offering.companionPriceCents! - firstBookingPriceCents!)
    : null;

  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId, status: "active" },
    include: { plan: { include: { entitlements: true, entitlementsFromPlan: { include: { entitlements: true } } } } },
  });

  // A non-member who'd otherwise pay full price for Dr. Dish self-serve may
  // have a purchased 10-pack to draw from instead. Checked before the
  // membership switch below, not as part of it — the pack is a separate
  // purchase, not a Training Plan benefit, and applies only to the solo
  // non-member rate (a "bring a teammate" companion still pays the flat
  // companion price, not a pack credit).
  if (offering.program.programType === "self_serve_dr_dish" && !isCompanion) {
    const hasMemberPricing = memberships.some((m) =>
      effectiveEntitlements(m.plan).some(
        (e) => e.benefitType === "member_pricing" && (e.programId === null || e.programId === offering.programId)
      )
    );
    if (!hasMemberPricing) {
      const pack = await prisma.credit.findFirst({
        where: { athleteId, creditType: "dr_dish_ten_pack", status: "issued", balance: { gt: 0 } },
        orderBy: { createdAt: "asc" },
      });
      if (pack) return { kind: "uses_pack_credit", creditId: pack.id, remaining: pack.balance };
    }
  }

  if (memberships.length === 0) {
    return {
      kind: "full_price",
      priceCents: isCompanion ? companionChargeCents : offering.priceCents,
      memberPriceCents: isCompanion ? null : offering.memberPriceCents,
    };
  }

  switch (offering.creditRule) {
    case "included": {
      const m = memberships.find((mm) =>
        effectiveEntitlements(mm.plan).some(
          (e) =>
            (e.benefitType === "class_credit" || e.benefitType === "member_pricing") &&
            (e.programId === null || e.programId === offering.programId)
        )
      );
      return m
        ? { kind: "included", planName: m.plan.name }
        : {
            kind: "full_price",
            priceCents: isCompanion ? companionChargeCents : offering.priceCents,
            memberPriceCents: isCompanion ? null : offering.memberPriceCents,
          };
    }

    case "uses_credit": {
      for (const m of memberships) {
        const ent = effectiveEntitlements(m.plan).find(
          (e) => e.benefitType === "class_credit" && e.programId === offering.programId
        );
        if (!ent?.quantityPerPeriod) continue;

        const { start: periodStart, end: periodEnd } = entitlementPeriodBounds(m, sessionStart);
        // A cancelled booking still counts unless its credit was actually
        // restored (cancelled >= REFUND_CUTOFF_HOURS before start — see
        // cancelBookingById in lib/booking.ts). A late cancellation still
        // spends the allowance, same as skipping the class outright.
        const used = await prisma.booking.count({
          where: {
            athleteId,
            OR: [{ status: { not: "cancelled" } }, { status: "cancelled", creditRestored: false, creditSource: { not: null } }],
            session: {
              programId: offering.programId,
              startTime: { gte: periodStart, lt: periodEnd },
            },
          },
        });
        const remaining = ent.quantityPerPeriod - used;
        if (remaining >= offering.creditsPerBooking) {
          return {
            kind: "uses_credit",
            credits: offering.creditsPerBooking,
            planName: m.plan.name,
            remaining,
          };
        }
        // Allowance spent for this billing period. Say so explicitly rather
        // than quietly falling through to a charge the family didn't expect.
        //
        // A member price of 0 is NOT honoured here. "Uses a credit" and "free
        // for members" are contradictory configurations — if the sessions were
        // free there would be nothing for the credit to buy — so a zero member
        // price is read as "unset" and the standard price applies once the
        // period's allowance is gone. Otherwise a plan capped at N sessions would
        // silently grant unlimited ones, which is the expensive direction to be
        // wrong in. An intentional free-after-allowance benefit should be
        // configured as creditRule = included.
        const memberPrice =
          offering.memberPriceCents && offering.memberPriceCents > 0
            ? offering.memberPriceCents
            : offering.priceCents;
        return { kind: "credit_exhausted", planName: m.plan.name, priceCents: memberPrice };
      }
      return { kind: "full_price", priceCents: offering.priceCents, memberPriceCents: offering.memberPriceCents };
    }

    case "member_price": {
      const m = memberships.find((mm) =>
        effectiveEntitlements(mm.plan).some(
          (e) =>
            e.benefitType === "member_pricing" &&
            (e.programId === null || e.programId === offering.programId)
        )
      );
      return m
        ? {
            kind: "member_price",
            priceCents: isCompanion ? companionChargeCents : offering.memberPriceCents ?? offering.priceCents,
            planName: m.plan.name,
          }
        : {
            kind: "full_price",
            priceCents: isCompanion ? companionChargeCents : offering.priceCents,
            memberPriceCents: isCompanion ? null : offering.memberPriceCents,
          };
    }

    case "separate_payment":
    default:
      return {
        kind: "full_price",
        priceCents: isCompanion ? companionChargeCents : offering.priceCents,
        memberPriceCents: isCompanion ? null : offering.memberPriceCents,
      };
  }
}
