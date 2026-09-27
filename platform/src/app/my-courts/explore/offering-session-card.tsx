"use client";

import { useState } from "react";
import {
  bookSession,
  cancelWaitlistEntry,
  acceptWaitlistOffer,
  declineWaitlistOffer,
  purchaseDrDishTenPack,
} from "@/app/my-courts/actions";
import { ConfirmSubmitButton } from "./confirm-submit-button";

// One published session, and what each athlete in this family can do with it.
// Availability wording comes from the shared availability module, so a parent
// and an admin are never looking at two different accounts of how full it is.

export type Card = {
  sessionId: string;
  offeringId: string;
  offeringName: string;
  registrationMode: string;
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
  capacity: number | null;
  booked: number;
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

const fmtTimeOnly = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));

const AVAILABILITY_TONE: Record<string, string> = {
  available: "text-gray-dark",
  few_spots: "text-orange",
  full: "text-gray-dark",
  waitlist: "text-orange",
  registration_closed: "text-gray-dark",
  coming_soon: "text-gray-dark",
};

function PerAthleteRow({ card, a }: { card: Card; a: Card["perAthlete"][number] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-light px-3 py-2.5">
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
        <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">You&rsquo;re In</span>
      ) : a.waitlistOffered && a.waitlistEntryId ? (
        // The explicit promotion step. A spot opened; the family chooses.
        <div className="flex items-center gap-2">
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">Spot Available</span>
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
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">On the List</span>
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
  );
}

// Once per card, not once per athlete-row: a Dr. Dish day-group renders one
// PerAthleteRow per 30-min slot per athlete, so a link that lived there would
// repeat a dozen times over. Buying a pack isn't tied to any one slot anyway
// — it banks credits for whichever Dr. Dish visit the family books next.
function TenPackLinks({ card }: { card: Card }) {
  if (card.programTypeLabel !== "Self-Service Dr. Dish") return null;
  const notYetIn = card.perAthlete.filter((a) => a.eligible && !a.hasSeat);
  if (notYetIn.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
      {notYetIn.map((a) => (
        <form key={a.athleteId} action={purchaseDrDishTenPack.bind(null, a.athleteId)}>
          <button type="submit" className="font-body text-xs font-bold text-orange underline">
            Buy {a.athleteName}&rsquo;s 10-Pack — $250
          </button>
        </form>
      ))}
    </div>
  );
}

function CardChrome({ card, timeLabel }: { card: Card; timeLabel: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        {/* When it is comes first — that's the question someone scanning a
            list of sessions is actually asking, before what it's called. */}
        <p className="font-sport text-lg font-bold text-orange">{timeLabel}</p>
        <h2 className="font-heading font-bold text-black">{card.offeringName}</h2>
        <p className="font-body text-[11.5px] font-medium uppercase tracking-wide text-gray-dark">
          {[card.sport, card.programTypeLabel].filter(Boolean).join(" · ")}
        </p>
        <p className="font-body text-xs text-gray-dark">
          {[card.gradeLabel, card.resourceName, card.coachNames[0]].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`whitespace-nowrap font-sport text-xs font-bold uppercase tracking-wide ${
            AVAILABILITY_TONE[card.availability.state] ?? "text-gray-dark"
          }`}
        >
          {card.availability.state === "waitlist" ? "Packed House" : card.availability.label}
        </p>
        {card.capacity !== null && (
          <p className="whitespace-nowrap font-body text-[11px] text-gray-dark">
            {card.booked} of {card.capacity} registered
          </p>
        )}
      </div>
    </div>
  );
}

export function OfferingSessionCard({ card }: { card: Card }) {
  return (
    <article className="rounded-lg border border-gray-mid bg-white px-4 py-4">
      <CardChrome card={card} timeLabel={fmtWhen(card.startTime)} />

      {card.shortDescription ? (
        <p className="mb-3 font-body text-sm text-gray-dark">{card.shortDescription}</p>
      ) : null}

      {card.availability.state === "waitlist" ? (
        <p className="mb-3 font-body text-sm text-gray-dark">This session is full.</p>
      ) : null}

      <TenPackLinks card={card} />

      <div className="flex flex-col gap-2">
        {card.perAthlete.map((a) => (
          <PerAthleteRow key={a.athleteId} card={card} a={a} />
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

// A salon-style time grid: tap a time to pick it, one booking panel opens
// below for whichever slot is selected — instead of a "few spots" pill.
const SLOT_TONE: Record<string, string> = {
  available: "border-gray-mid bg-white text-black hover:border-black",
  few_spots: "border-orange bg-white text-orange hover:bg-orange/5",
  waitlist: "border-gray-mid bg-gray-light text-gray-dark hover:border-orange hover:text-orange",
  full: "border-gray-mid bg-gray-light text-gray-dark",
  registration_closed: "border-gray-mid bg-gray-light text-gray-dark",
  coming_soon: "border-gray-mid bg-gray-light text-gray-dark",
};

const SLOT_NOTE: Record<string, string> = {
  few_spots: "Few left",
  waitlist: "Waitlist",
  full: "Full",
};

// Several same-day slots of the same offering (Dr. Dish's 30-min blocks,
// typically) used to read as one clogged, scrolling list — a full booking
// card repeated per slot. This is the same idea a hair-salon booker uses:
// every time for the day laid out as one scannable grid, tap a time to open
// just that slot's booking panel below it. Booking logic is untouched —
// each time button is still just picking which sessionId/form is shown.
export function GroupedOfferingCard({ cards }: { cards: Card[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (cards.length === 1) return <OfferingSessionCard card={cards[0]} />;

  const first = cards[0];
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(first.startTime));
  const selected = cards.find((c) => c.sessionId === selectedId) ?? null;

  return (
    <article className="rounded-lg border border-gray-mid bg-white px-4 py-4">
      <CardChrome card={first} timeLabel={dayLabel} />

      {first.shortDescription ? (
        <p className="mb-3 font-body text-sm text-gray-dark">{first.shortDescription}</p>
      ) : null}

      <TenPackLinks card={first} />

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {cards.map((card) => {
          const isSelected = card.sessionId === selectedId;
          const note = SLOT_NOTE[card.availability.state];
          return (
            <button
              key={card.sessionId}
              type="button"
              onClick={() => setSelectedId(isSelected ? null : card.sessionId)}
              aria-pressed={isSelected}
              className={`flex min-h-[52px] flex-col items-center justify-center rounded-md border px-1 py-1.5 font-sport text-xs font-bold uppercase tracking-wide transition-colors ${
                isSelected ? "border-black bg-black text-white" : SLOT_TONE[card.availability.state] ?? "border-gray-mid bg-white text-black"
              }`}
            >
              <span>{fmtTimeOnly(card.startTime)}</span>
              {note ? (
                <span className={`mt-0.5 font-body text-[9.5px] font-normal normal-case tracking-normal ${isSelected ? "text-white/70" : ""}`}>
                  {note}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-3 rounded-md border border-gray-mid/70 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-heading text-[13px] font-bold text-black">{fmtTimeOnly(selected.startTime)}</span>
            <span className="text-right">
              <span
                className={`block font-sport text-[11.5px] font-bold uppercase tracking-wide ${
                  AVAILABILITY_TONE[selected.availability.state] ?? "text-gray-dark"
                }`}
              >
                {selected.availability.state === "waitlist" ? "Packed House" : selected.availability.label}
              </span>
              {selected.capacity !== null && (
                <span className="block font-body text-[10.5px] text-gray-dark">
                  {selected.booked} of {selected.capacity} registered
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {selected.perAthlete.map((a) => (
              <PerAthleteRow key={a.athleteId} card={selected} a={a} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 font-body text-sm text-gray-dark">Pick a time above to book.</p>
      )}

      {first.whatToBring.length > 0 ? (
        <p className="mt-3 font-body text-xs text-gray-dark">
          <span className="font-sport font-bold uppercase tracking-wide">Bring:</span>{" "}
          {first.whatToBring.join(", ")}
        </p>
      ) : null}
      {first.parentInstructions ? (
        <p className="mt-1 font-body text-xs text-gray-dark">{first.parentInstructions}</p>
      ) : null}
    </article>
  );
}
