import { bookSession, cancelWaitlistEntry, acceptWaitlistOffer, declineWaitlistOffer } from "@/app/my-courts/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

// One published session, and what each athlete in this family can do with it.
// Availability wording comes from the shared availability module, so a parent
// and an admin are never looking at two different accounts of how full it is.

type Card = {
  sessionId: string;
  offeringName: string;
  programTypeLabel: string;
  sport: string | null;
  shortDescription: string | null;
  gradeLabel: string | null;
  whatToBring: string[];
  parentInstructions: string | null;
  startTime: string;
  endTime: string;
  resourceName: string | null;
  coachNames: string[];
  availability: {
    state: string;
    label: string;
    spotsLeft: number | null;
    canRegister: boolean;
    canJoinWaitlist: boolean;
  };
  perAthlete: {
    athleteId: string;
    athleteName: string;
    eligible: boolean;
    ineligibleReason: string | null;
    bookingRuleText: string;
    hasSeat: boolean;
    waitlisted: boolean;
    waitlistOffered: boolean;
    waitlistEntryId: string | null;
  }[];
};

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(iso));

const AVAILABILITY_TONE: Record<string, string> = {
  available: "text-gray-dark",
  few_spots: "text-orange",
  full: "text-gray-dark",
  waitlist: "text-orange",
  registration_closed: "text-gray-dark",
  coming_soon: "text-gray-dark",
};

export function OfferingSessionCard({ card }: { card: Card }) {
  return (
    <article className="rounded-lg border border-gray-mid bg-white px-4 py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
            {[card.sport, card.programTypeLabel].filter(Boolean).join(" · ")}
          </p>
          <h2 className="font-heading font-bold text-black">{card.offeringName}</h2>
          <p className="font-body text-sm text-gray-dark">{fmtWhen(card.startTime)}</p>
          <p className="font-body text-xs text-gray-dark">
            {[card.gradeLabel, card.resourceName, card.coachNames[0]].filter(Boolean).join(" · ")}
          </p>
        </div>
        <p
          className={`whitespace-nowrap font-sport text-xs font-bold uppercase tracking-wide ${
            AVAILABILITY_TONE[card.availability.state] ?? "text-gray-dark"
          }`}
        >
          {card.availability.state === "waitlist" ? "Packed House" : card.availability.label}
        </p>
      </div>

      {card.shortDescription ? (
        <p className="mb-3 font-body text-sm text-gray-dark">{card.shortDescription}</p>
      ) : null}

      {card.availability.state === "waitlist" ? (
        <p className="mb-3 font-body text-sm text-gray-dark">This session is full.</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {card.perAthlete.map((a) => (
          <div
            key={a.athleteId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-light px-3 py-2.5"
          >
            <div className="min-w-0">
              <span className="font-heading text-sm font-bold text-black">{a.athleteName}</span>
              {a.eligible && !a.hasSeat && a.bookingRuleText ? (
                <span className="ml-2 font-body text-xs text-gray-dark">{a.bookingRuleText}</span>
              ) : null}
              {!a.eligible && a.ineligibleReason ? (
                <span className="ml-2 font-body text-xs text-gray-dark">{a.ineligibleReason}</span>
              ) : null}
            </div>

            {a.hasSeat ? (
              <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
                You&rsquo;re In
              </span>
            ) : a.waitlistOffered && a.waitlistEntryId ? (
              // The explicit promotion step. A spot opened; the family chooses.
              <div className="flex items-center gap-2">
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
                  Spot Available
                </span>
                <form action={acceptWaitlistOffer.bind(null, a.waitlistEntryId, a.athleteId)}>
                  <button
                    type="submit"
                    className="min-h-9 rounded-md bg-orange px-3 font-sport text-xs font-bold uppercase tracking-wide text-white"
                  >
                    Take It
                  </button>
                </form>
                <form action={declineWaitlistOffer.bind(null, a.waitlistEntryId, a.athleteId)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Pass on this spot for ${a.athleteName}? It goes to the next family.`}
                    ariaLabel={`Decline the spot for ${a.athleteName}`}
                    className="font-body text-xs text-gray-dark underline"
                  >
                    Pass
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : a.waitlisted && a.waitlistEntryId ? (
              <div className="flex items-center gap-3">
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                  On the List
                </span>
                <form action={cancelWaitlistEntry.bind(null, a.waitlistEntryId, a.athleteId)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Leave the waitlist for ${a.athleteName}?`}
                    ariaLabel={`Leave waitlist for ${a.athleteName}`}
                    className="font-body text-xs text-gray-dark underline"
                  >
                    Leave
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : !a.eligible ? null : card.availability.canRegister ? (
              <form action={bookSession.bind(null, a.athleteId, card.sessionId)}>
                <button
                  type="submit"
                  className="min-h-9 rounded-md bg-black px-3 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
                >
                  Book
                </button>
              </form>
            ) : card.availability.canJoinWaitlist ? (
              <form action={bookSession.bind(null, a.athleteId, card.sessionId)}>
                <button
                  type="submit"
                  className="min-h-9 rounded-md border border-black px-3 font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange hover:text-orange"
                >
                  Join Waitlist
                </button>
              </form>
            ) : (
              <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                {card.availability.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {card.whatToBring.length > 0 ? (
        <p className="mt-3 font-body text-xs text-gray-dark">
          <span className="font-sport font-bold uppercase tracking-wide">Bring:</span>{" "}
          {card.whatToBring.join(", ")}
        </p>
      ) : null}
      {card.parentInstructions ? (
        <p className="mt-1 font-body text-xs text-gray-dark">{card.parentInstructions}</p>
      ) : null}
    </article>
  );
}
