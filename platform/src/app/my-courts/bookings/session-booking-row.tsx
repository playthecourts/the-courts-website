import { bookSession, cancelBooking, cancelWaitlistEntry } from "@/app/my-courts/actions";
import type { BookingEligibility } from "@/lib/entitlements";

function formatPrice(cents: number | null) {
  if (cents === null || cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function EligibilityLabel({ eligibility }: { eligibility: BookingEligibility }) {
  if (eligibility.type === "included") {
    return (
      <span className="text-xs text-neutral-500">
        Included — {eligibility.membershipPlanName}
      </span>
    );
  }
  if (eligibility.type === "member_price") {
    return (
      <span className="text-xs text-neutral-500">
        {formatPrice(eligibility.priceCents)} member price
      </span>
    );
  }
  return <span className="text-xs text-neutral-500">{formatPrice(eligibility.priceCents)}</span>;
}

export function SessionBookingRow({
  athleteId,
  athleteName,
  sessionId,
  bookingId,
  waitlistEntryId,
  isFull,
  eligibility,
}: {
  athleteId: string;
  athleteName: string;
  sessionId: string;
  bookingId: string | null;
  waitlistEntryId: string | null;
  isFull: boolean;
  eligibility: BookingEligibility | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm">
      <span className="font-medium">{athleteName}</span>

      {bookingId ? (
        <form action={cancelBooking.bind(null, bookingId)} className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-700">Booked</span>
          <button type="submit" className="text-xs font-medium text-red-600 underline">
            Cancel
          </button>
        </form>
      ) : waitlistEntryId ? (
        <form
          action={cancelWaitlistEntry.bind(null, waitlistEntryId, athleteId)}
          className="flex items-center gap-2"
        >
          <span className="text-xs font-semibold text-amber-700">Waitlisted</span>
          <button type="submit" className="text-xs font-medium text-red-600 underline">
            Leave waitlist
          </button>
        </form>
      ) : (
        <form action={bookSession.bind(null, athleteId, sessionId)} className="flex items-center gap-3">
          {eligibility && !isFull && <EligibilityLabel eligibility={eligibility} />}
          <button type="submit" className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white">
            {isFull ? "Join Waitlist" : "Book"}
          </button>
        </form>
      )}
    </div>
  );
}
