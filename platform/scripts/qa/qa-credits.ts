import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, p: unknown, m: boolean) {
  if (r === "server-only") return {};
  return _load.call(this, r, p, m);
};

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

// Scenario 14 done properly: a Weekly Plan athlete booking Group Training must
// consume exactly one session credit, must report the remaining balance, and
// must stop being "included" once the weekly allowance is spent.

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (n: string, p: boolean, d: string) => { results.push({ name: n, pass: p, detail: d }); console.log(`${p ? "PASS" : "FAIL"}  ${n}\n      ${d}`); };

async function main() {
  const { resolveBookingRule } = await import("../../src/lib/programs/pricing");

  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] 3rd–5th" } },
    include: { sessions: { where: { status: "scheduled" }, orderBy: { startTime: "asc" } } },
  });
  const plan = await prisma.membershipPlan.findFirstOrThrow({ where: { name: "Weekly Basketball" } });
  const membership = await prisma.athleteMembership.findFirstOrThrow({
    where: { membershipPlanId: plan.id, status: "active" },
  });

  // Grant the Weekly plan 2 credits/week on THIS program, for the test only.
  const entitlement = await prisma.planEntitlement.create({
    data: { membershipPlanId: plan.id, benefitType: "class_credit", programId: offering.programId, quantityPerPeriod: 2 },
  });

  const session = offering.sessions[0];
  const before = await resolveBookingRule(membership.athleteId, offering.id, session.startTime);
  check(
    "Weekly Plan member: booking uses a credit and the balance is stated",
    before.kind === "uses_credit" && before.credits === 1 && before.remaining === 2,
    JSON.stringify(before)
  );

  // The weekly allowance is counted per Sunday-anchored week, and this
  // offering's sessions are exactly 7 days apart — so no two of them share a
  // week. Add a temporary second session two days after the first to create a
  // genuine same-week pair.
  const sameWeekSession = await prisma.session.create({
    data: {
      programId: offering.programId,
      offeringId: offering.id,
      startTime: new Date(session.startTime.getTime() + 2 * 86_400_000),
      endTime: new Date(session.endTime.getTime() + 2 * 86_400_000),
      capacity: 8,
      title: "[QA] same-week credit test",
    },
  });

  const madeBookings: string[] = [];
  for (const s of [session, sameWeekSession]) {
    const b = await prisma.booking.upsert({
      where: { sessionId_athleteId: { sessionId: s.id, athleteId: membership.athleteId } },
      create: { sessionId: s.id, athleteId: membership.athleteId, status: "booked", creditSource: plan.name },
      update: { status: "booked", creditSource: plan.name },
    });
    madeBookings.push(b.id);
  }

  const after = await resolveBookingRule(membership.athleteId, offering.id, session.startTime);
  check(
    "Allowance spent: says so plainly instead of quietly charging",
    after.kind === "credit_exhausted" && after.planName === plan.name,
    JSON.stringify(after)
  );

  // A non-member on the same offering pays full price.
  const nonMember = await prisma.athlete.findFirstOrThrow({
    where: { memberships: { none: { status: "active" } } },
  });
  const nonMemberRule = await resolveBookingRule(nonMember.id, offering.id, session.startTime);
  check(
    "Non-member pays the standard price on the same offering",
    nonMemberRule.kind === "full_price" && nonMemberRule.priceCents === offering.priceCents,
    JSON.stringify(nonMemberRule)
  );

  // Cancelling a booking frees the credit back into the weekly allowance.
  await prisma.booking.update({ where: { id: madeBookings[0] }, data: { status: "cancelled" } });
  const afterCancel = await resolveBookingRule(membership.athleteId, offering.id, session.startTime);
  check(
    "Cancelling returns the credit to the weekly allowance",
    afterCancel.kind === "uses_credit" && afterCancel.remaining === 1,
    JSON.stringify(afterCancel)
  );

  // Cleanup — remove only what this script created.
  await prisma.booking.deleteMany({ where: { id: { in: madeBookings } } });
  await prisma.session.delete({ where: { id: sameWeekSession.id } });
  await prisma.planEntitlement.delete({ where: { id: entitlement.id } });

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} credit scenarios passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
