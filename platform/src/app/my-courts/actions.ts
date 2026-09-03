"use server";

import { revalidatePath } from "next/cache";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bookAthleteIntoSession, cancelBookingById, cancelWaitlistEntryById } from "@/lib/booking";
import { assertWaiversSigned } from "@/lib/waivers";

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
