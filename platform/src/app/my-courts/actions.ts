"use server";

import { revalidatePath } from "next/cache";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bookAthleteIntoSession, cancelBookingById, cancelWaitlistEntryById } from "@/lib/booking";
import { assertWaiversSigned } from "@/lib/waivers";
import { acceptOffer, declineOffer } from "@/lib/programs/waitlist";

async function assertOwnsAthlete(athleteId: string) {
  const guardian = await getCurrentGuardian();
  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === athleteId)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this athlete.");
  }
  return guardian;
}

export async function bookSession(athleteId: string, sessionId: string) {
  const guardian = await assertOwnsAthlete(athleteId);
  await assertWaiversSigned(guardian.id, athleteId);
  await bookAthleteIntoSession(sessionId, athleteId, guardian.id);
  revalidatePath("/my-courts/bookings");
  revalidatePath("/my-courts/schedule");
}

export async function cancelBooking(bookingId: string) {
  const guardian = await getCurrentGuardian();
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { athlete: true },
  });

  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === booking.athlete.id)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this booking.");
  }

  await cancelBookingById(bookingId);
  revalidatePath("/my-courts/bookings");
  revalidatePath("/my-courts/schedule");
}

export async function cancelWaitlistEntry(waitlistEntryId: string, athleteId: string) {
  await assertOwnsAthlete(athleteId);
  await cancelWaitlistEntryById(waitlistEntryId);
  revalidatePath("/my-courts/bookings");
}

export async function setRsvp(bookingId: string, rsvpStatus: "going" | "not_going" | "not_sure") {
  const guardian = await getCurrentGuardian();
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { athlete: true } });

  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === booking.athlete.id)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this booking.");
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { rsvpStatus } });
  revalidatePath("/my-courts/league");
  revalidatePath("/my-courts/schedule");
}

// --- Waitlist offers -------------------------------------------------------
//
// A freed seat is offered, not assigned. These two actions are the only way a
// waitlisted athlete becomes a booked one, and both require the guardian to
// act — nothing here charges a family because somebody else dropped out.

export async function acceptWaitlistOffer(waitlistEntryId: string, athleteId: string) {
  const guardian = await assertOwnsAthlete(athleteId);
  await assertWaiversSigned(guardian.id, athleteId);

  // Returns void so it can be used directly as a <form action>. A refusal
  // (offer expired, session filled first) is reflected by the re-rendered page
  // rather than a thrown error, because both are normal outcomes of a race the
  // family didn't lose through any fault of theirs.
  await acceptOffer(waitlistEntryId, guardian.id);
  revalidatePath("/my-courts/explore");
  revalidatePath("/my-courts/bookings");
  revalidatePath("/my-courts/schedule");
}

export async function declineWaitlistOffer(waitlistEntryId: string, athleteId: string) {
  await assertOwnsAthlete(athleteId);
  await declineOffer(waitlistEntryId, null);
  revalidatePath("/my-courts/explore");
  revalidatePath("/my-courts/bookings");
}
