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

import type { BookingRule } from "./pricing-types";
export type { BookingRule };

/// Sunday-anchored, matching lib/entitlements.ts so the two accountings of a
/// weekly allowance can never disagree.
function startOfWeekUTC(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

/// The rule for one athlete booking one occurrence of one offering. This is the
/// single place that decides, and both the Parent App and the admin booking
/// screen render its result — so a parent and an admin always see the same
/// answer to "what does this cost?".
export async function resolveBookingRule(
  athleteId: string,
  offeringId: string,
  sessionStart: Date
): Promise<BookingRule> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    select: {
      programId: true,
      priceCents: true,
      memberPriceCents: true,
      creditRule: true,
      creditsPerBooking: true,
      pricingModel: true,
    },
  });

  if (offering.pricingModel === "free" || offering.creditRule === "free") return { kind: "free" };

  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId, status: "active" },
    include: { plan: { include: { entitlements: true } } },
  });

  if (memberships.length === 0) {
    return { kind: "full_price", priceCents: offering.priceCents };
  }

  switch (offering.creditRule) {
    case "included": {
      const m = memberships.find((mm) =>
        mm.plan.entitlements.some(
          (e) =>
            (e.benefitType === "class_credit" || e.benefitType === "member_pricing") &&
            (e.programId === null || e.programId === offering.programId)
        )
      );
      return m
        ? { kind: "included", planName: m.plan.name }
        : { kind: "full_price", priceCents: offering.priceCents };
    }

    case "uses_credit": {
      for (const m of memberships) {
        const ent = m.plan.entitlements.find(
          (e) => e.benefitType === "class_credit" && e.programId === offering.programId
        );
        if (!ent?.quantityPerPeriod) continue;

        const weekStart = startOfWeekUTC(sessionStart);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
        const used = await prisma.booking.count({
          where: {
            athleteId,
            status: { not: "cancelled" },
            session: {
              programId: offering.programId,
              startTime: { gte: weekStart, lt: weekEnd },
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
        // Allowance spent for the week. Say so explicitly rather than quietly
        // falling through to a charge the family didn't expect.
        //
        // A member price of 0 is NOT honoured here. "Uses a credit" and "free
        // for members" are contradictory configurations — if the sessions were
        // free there would be nothing for the credit to buy — so a zero member
        // price is read as "unset" and the standard price applies once the
        // weekly allowance is gone. Otherwise a plan capped at N sessions would
        // silently grant unlimited ones, which is the expensive direction to be
        // wrong in. An intentional free-after-allowance benefit should be
        // configured as creditRule = included.
        const memberPrice =
          offering.memberPriceCents && offering.memberPriceCents > 0
            ? offering.memberPriceCents
            : offering.priceCents;
        return { kind: "credit_exhausted", planName: m.plan.name, priceCents: memberPrice };
      }
      return { kind: "full_price", priceCents: offering.priceCents };
    }

    case "member_price": {
      const m = memberships.find((mm) =>
        mm.plan.entitlements.some(
          (e) =>
            e.benefitType === "member_pricing" &&
            (e.programId === null || e.programId === offering.programId)
        )
      );
      return m
        ? {
            kind: "member_price",
            priceCents: offering.memberPriceCents ?? offering.priceCents,
            planName: m.plan.name,
          }
        : { kind: "full_price", priceCents: offering.priceCents };
    }

    case "separate_payment":
    default:
      return { kind: "full_price", priceCents: offering.priceCents };
  }
}
