import { bookSession, cancelBooking, cancelWaitlistEntry } from "@/app/my-courts/actions";
import type { BookingEligibility } from "@/lib/entitlements";

function formatPrice(cents: number | null) {
  if (cents === null || cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function EligibilityLabel({ eligibility }: { eligibility: BookingEligibility }) {
  if (eligibility.type === "included") {
    return (
      <span className="font-body text-xs text-gray-dark">
        Included in your plan
      </span>
    );
  }
  if (eligibility.type === "member_price") {
    return (
      <span className="font-body text-xs text-gray-dark">
        {formatPrice(eligibility.priceCents)} member rate
      </span>
    );
  }
  return <span className="font-body text-xs text-gray-dark">{formatPrice(eligibility.priceCents)}</span>;
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
    <div className="flex items-center justify-between rounded-md bg-gray-light px-3 py-2.5">
      <span className="font-heading text-sm font-bold text-black">{athleteName}</span>

      {bookingId ? (
        <form action={cancelBooking.bind(null, bookingId)} className="flex items-center gap-3">
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">You&rsquo;re In</span>
          <button type="submit" className="font-body text-xs text-gray-dark underline">
            Cancel
          </button>
        </form>
      ) : waitlistEntryId ? (
        <form
          action={cancelWaitlistEntry.bind(null, waitlistEntryId, athleteId)}
          className="flex items-center gap-3"
        >
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">Waitlisted</span>
          <button type="submit" className="font-body text-xs text-gray-dark underline">
            Leave Waitlist
          </button>
        </form>
      ) : (
        <form action={bookSession.bind(null, athleteId, sessionId)} className="flex items-center gap-3">
          {eligibility && !isFull && <EligibilityLabel eligibility={eligibility} />}
          <button
            type="submit"
            className="min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
          >
            {isFull ? "Join Waitlist" : "Book"}
          </button>
        </form>
      )}
    </div>
  );
}
