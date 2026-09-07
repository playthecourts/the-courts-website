// Pure presentation helpers. No "server-only", no Prisma, no Stripe — client
// components need these too, and importing them from the server-only pricing
// module would drag the database driver into the browser bundle.

import type { BookingRule } from "./pricing-types";

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/// Plain-language statement of a booking rule, shown wherever a family or an
/// admin needs to know what a Training Plan actually does here.
export function describeBookingRule(rule: BookingRule): string {
  switch (rule.kind) {
    case "free":
      return "Free";
    case "included":
      return `Included with ${rule.planName}`;
    case "uses_credit":
      return `Uses ${rule.credits} session${rule.credits === 1 ? "" : "s"} from ${rule.planName} · ${rule.remaining} left this week`;
    case "credit_exhausted":
      return `${rule.planName} sessions used up this week · ${formatCents(rule.priceCents)}`;
    case "member_price":
      return `${formatCents(rule.priceCents)} with ${rule.planName}`;
    case "full_price":
      return formatCents(rule.priceCents);
  }
}
