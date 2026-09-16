"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { bookAthleteIntoSession, cancelBookingById, cancelWaitlistEntryById, resumeBookingCheckout } from "@/lib/booking";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
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

// A thrown error here crashes the whole page instead of showing a message —
// the same real production bug this pattern already caused once on League
// registration (Vercel error digest 4060215026). Redirect to sign it instead.
async function requireWaiversOrRedirect(guardianId: string, athleteId: string, backTo: string) {
  const unsigned = await getUnsignedRequiredWaivers(guardianId, athleteId);
  if (unsigned.length > 0) {
    redirect(`/my-courts/waivers?required=booking&back=${encodeURIComponent(backTo)}`);
  }
}

export async function bookSession(athleteId: string, sessionId: string) {
  const guardian = await assertOwnsAthlete(athleteId);
  await requireWaiversOrRedirect(guardian.id, athleteId, "/my-courts/explore");
  const result = await bookAthleteIntoSession(sessionId, athleteId, guardian.id);
  revalidatePath("/my-courts/bookings");
  revalidatePath("/my-courts/schedule");
  revalidatePath("/my-courts/explore");
  // A paid booking's seat is already held (see bookAthleteIntoSession) — this
  // redirect just sends the family to pay for it. redirect() throws, so
  // nothing after this line runs when it fires.
  if (result.status === "booked" && "checkoutUrl" in result && result.checkoutUrl) {
    redirect(result.checkoutUrl);
  }
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

/// Resumes payment on a booking that's still holding its seat but never
/// completed Checkout — used by the Payments Due section (and anywhere else
/// a "Pay →" CTA needs to send a family back to Stripe for a seat they
/// already have).
export async function payBooking(bookingId: string) {
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

  const checkoutUrl = await resumeBookingCheckout(bookingId);
  redirect(checkoutUrl);
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
  await requireWaiversOrRedirect(guardian.id, athleteId, "/my-courts/explore");

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

// --- Dr. Dish 10-pack --------------------------------------------------
//
// The real Stripe Product/Price for this — $250, one-time, non-member rate
// only (a member already gets the cheaper $20/session member price and has
// no reason to buy a pack of the non-member rate).
const DR_DISH_TEN_PACK_PRICE_ID = "price_1UG8J7KqZ4a13U826eCUM3EV";

export async function purchaseDrDishTenPack(athleteId: string) {
  const guardian = await assertOwnsAthlete(athleteId);

  let customerId = guardian.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: guardian.email ?? undefined,
      name: guardian.name,
      metadata: { guardianId: guardian.id },
    });
    customerId = customer.id;
    await prisma.guardian.update({ where: { id: guardian.id }, data: { stripeCustomerId: customerId } });
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: DR_DISH_TEN_PACK_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/my-courts/explore?checkout=success`,
    cancel_url: `${origin}/my-courts/explore?checkout=cancelled`,
    metadata: { type: "dr_dish_ten_pack", athleteId, guardianId: guardian.id },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  redirect(session.url);
}
