import "server-only";

// ---------------------------------------------------------------------------
// What a family sees about whether they can get in.
//
// Every state here is derived from real capacity and real dates. There is no
// manufactured scarcity: "Few spots left" appears only when the actual number
// of remaining seats is at or below the offering's own configured threshold.
// ---------------------------------------------------------------------------

export type AvailabilityState =
  | "coming_soon"
  | "available"
  | "few_spots"
  | "full"
  | "waitlist"
  | "registration_closed";

export type AvailabilityInput = {
  status: string;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  closeWhenFull: boolean;
  waitlistMode: "none" | "automatic" | "manual";
  lowSpotThreshold: number;
  capacity: number | null;
  booked: number;
};

export type Availability = {
  state: AvailabilityState;
  /// Parent-facing label. The Courts' voice, not a status code.
  label: string;
  spotsLeft: number | null;
  canRegister: boolean;
  canJoinWaitlist: boolean;
};

export function availabilityFor(input: AvailabilityInput, now: Date = new Date()): Availability {
  const spotsLeft = input.capacity === null ? null : Math.max(0, input.capacity - input.booked);
  const isFull = spotsLeft !== null && spotsLeft === 0;
  const waitlistOffered = input.waitlistMode !== "none";

  const closed =
    input.status === "registration_closed" ||
    input.status === "completed" ||
    input.status === "cancelled" ||
    (input.registrationClosesAt !== null && now >= input.registrationClosesAt) ||
    (input.closeWhenFull && isFull && !waitlistOffered);

  if (input.registrationOpensAt !== null && now < input.registrationOpensAt) {
    return {
      state: "coming_soon",
      label: "Coming Soon",
      spotsLeft,
      canRegister: false,
      canJoinWaitlist: false,
    };
  }

  if (closed) {
    return {
      state: "registration_closed",
      label: "Registration Closed",
      spotsLeft,
      canRegister: false,
      canJoinWaitlist: false,
    };
  }

  if (isFull) {
    return waitlistOffered
      ? {
          state: "waitlist",
          // The Courts' own phrasing for a full session.
          label: "Packed House",
          spotsLeft: 0,
          canRegister: false,
          canJoinWaitlist: true,
        }
      : { state: "full", label: "Full", spotsLeft: 0, canRegister: false, canJoinWaitlist: false };
  }

  if (spotsLeft !== null && spotsLeft <= input.lowSpotThreshold) {
    return {
      state: "few_spots",
      label: `${spotsLeft} Spot${spotsLeft === 1 ? "" : "s"} Left`,
      spotsLeft,
      canRegister: true,
      canJoinWaitlist: false,
    };
  }

  return {
    state: "available",
    label: "Available",
    spotsLeft,
    canRegister: true,
    canJoinWaitlist: false,
  };
}

/// Whether an offering belongs in the Parent App's "Available This Week" —
/// published, visible, registration open, a real future session, and room (or a
/// waitlist). Curated by these rules, never by hand.
export function qualifiesForAvailableThisWeek(
  a: Availability,
  hasFutureSessionThisWeek: boolean
): boolean {
  return (
    hasFutureSessionThisWeek &&
    (a.state === "available" || a.state === "few_spots" || a.state === "waitlist")
  );
}
