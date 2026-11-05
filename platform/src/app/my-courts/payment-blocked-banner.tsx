import { paymentBlockedAthleteIds, PAYMENT_BLOCKED_MESSAGE } from "@/lib/membership-standing";
import { payPastDueMembership } from "./actions";

// Shown at the top of every booking surface (Explore, Camps & Events,
// Membership) when an athlete's membership payment failed and the grace
// period in lib/membership-standing.ts has run out. Booking is blocked for
// that athlete until the card is fixed — this is where they fix it.
export async function PaymentBlockedBanner({
  athletes,
}: {
  athletes: { id: string; firstName: string }[];
}) {
  const blocked = await paymentBlockedAthleteIds(athletes.map((a) => a.id));
  const blockedAthletes = athletes.filter((a) => blocked.has(a.id));
  if (blockedAthletes.length === 0) return null;

  // Only name the athlete when the family has more than one — otherwise it's
  // obvious who it's about.
  const showNames = athletes.length > 1;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-bg px-4 py-4">
      {blockedAthletes.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-sm text-near-black">
            {showNames && <span className="font-bold">{a.firstName}: </span>}
            {PAYMENT_BLOCKED_MESSAGE}
          </p>
          <form action={payPastDueMembership.bind(null, a.id)}>
            <button
              type="submit"
              className="rounded-full bg-black px-4 py-2 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
            >
              Update Card &rarr;
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
