import { bookSession, cancelBooking, cancelWaitlistEntry } from "@/app/my-courts/actions";

export function SessionBookingRow({
  athleteId,
  athleteName,
  sessionId,
  bookingId,
  waitlistEntryId,
  isFull,
}: {
  athleteId: string;
  athleteName: string;
  sessionId: string;
  bookingId: string | null;
  waitlistEntryId: string | null;
  isFull: boolean;
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
        <form action={bookSession.bind(null, athleteId, sessionId)}>
          <button type="submit" className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white">
            {isFull ? "Join Waitlist" : "Book"}
          </button>
        </form>
      )}
    </div>
  );
}
