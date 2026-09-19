// Repurposes the real "Volleyball Basics" Program/Offering (published, 0
// bookings, Coach Kenya, Wednesdays — but actually scheduled at 11:00 AM
// despite the marketing site claiming 5:00 PM) into "Basketball Basics"
// with Coach Johnny at the correct 5:00 PM. Reassigns all 9 real sessions'
// coach and time rather than creating a parallel program, since nobody has
// booked into any of them yet. Kept as a historical record.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import Stripe from "stripe";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const JOHNNY_STAFF_ID = "87317520-56e9-4363-8b2c-381a263c217e";
const KENYA_STAFF_ID = "40d46ece-0d9b-4e6d-afad-77ab02784ded";

async function main() {
  const offering = await prisma.offering.findFirstOrThrow({ where: { name: "Volleyball Basics" } });

  await prisma.program.update({
    where: { id: offering.programId },
    data: { name: "Basketball Basics", sport: "Basketball" },
  });

  await prisma.offering.update({
    where: { id: offering.id },
    data: {
      name: "Basketball Basics",
      shortDescription: "Introductory weekly session for athletes new to basketball.",
      fullDescription: "Introductory weekly session for athletes new to basketball.",
      visibleWebsite: true,
    },
  });

  if (offering.stripeProductId) {
    await stripe.products.update(offering.stripeProductId, { name: "Basketball Basics" });
  }

  const sessions = await prisma.session.findMany({
    where: { offeringId: offering.id },
    include: { coaches: true },
  });

  for (const s of sessions) {
    // Same calendar date, just moved from 11:00 AM to 5:00 PM Central
    // (16:00 UTC -> 22:00 UTC — Central is UTC-5 under CDT in this window).
    const newStart = new Date(s.startTime.getTime() + 6 * 60 * 60 * 1000);
    const newEnd = new Date(s.endTime.getTime() + 6 * 60 * 60 * 1000);
    await prisma.session.update({ where: { id: s.id }, data: { startTime: newStart, endTime: newEnd } });

    for (const c of s.coaches) {
      if (c.staffUserId === KENYA_STAFF_ID) {
        await prisma.sessionCoach.delete({ where: { sessionId_staffUserId: { sessionId: s.id, staffUserId: KENYA_STAFF_ID } } });
        await prisma.sessionCoach.create({ data: { sessionId: s.id, staffUserId: JOHNNY_STAFF_ID, role: c.role } });
      }
    }
    console.log(`${s.id}: ${newStart.toISOString()} -> ${newEnd.toISOString()}, coach reassigned`);
  }

  console.log(`\nDone — ${sessions.length} sessions moved to 5:00 PM Central and reassigned to Coach Johnny.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
