// One-off QA seed script — NOT part of the app runtime.
// Creates a Courts-controlled test parent account through the real,
// normal signup path (Supabase anon-key auth.signUp, same as a real
// parent), then attaches realistic fictional family data on top of the
// REAL existing catalog (real MembershipPlans, real Programs) rather
// than inventing parallel fake catalog entries.
//
// Run once: node scripts/seed-qa-account.js
// Prints the generated password to stdout only — never written to a file.
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("../src/generated/prisma");
const crypto = require("crypto");

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const QA_EMAIL = "qa-parent@playthecourts.com";

function randomPassword() {
  return crypto.randomBytes(12).toString("base64url"); // 16 chars, no source-controlled password
}

async function main() {
  const existing = await prisma.guardian.findUnique({ where: { email: QA_EMAIL } });
  if (existing) {
    console.log(`Already seeded — Guardian ${QA_EMAIL} exists (id ${existing.id}). Not creating a duplicate.`);
    console.log("Delete the guardian row (and its Supabase Auth user) first if you want a fresh reseed.");
    return;
  }

  const password = randomPassword();

  // 1. Real signup — same anon-key call the public /signup form uses.
  const { data, error } = await supabase.auth.signUp({ email: QA_EMAIL, password });
  if (error) throw new Error(`Supabase signUp failed: ${error.message}`);
  if (!data.user) throw new Error("Supabase signUp returned no user.");

  // 2. Real catalog lookups — attach to what actually exists, invent nothing.
  const weeklyBasketball = await prisma.membershipPlan.findFirstOrThrow({ where: { name: "Weekly Basketball" } });
  const basketballDev = await prisma.program.findFirstOrThrow({ where: { name: "Basketball Development" } });
  const fallLeague = await prisma.program.findFirstOrThrow({ where: { name: "Fall 2026 Basketball League" } });
  const requiredWaiver = await prisma.waiver.findFirstOrThrow({ where: { required: true } });

  // A real, already-scheduled upcoming Basketball Development session —
  // reusing production data instead of creating a parallel fake one.
  const upcomingClassSession = await prisma.session.findFirstOrThrow({
    where: { programId: basketballDev.id, status: "scheduled", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    const guardian = await tx.guardian.create({
      data: { authId: data.user.id, name: "Courts Test Family", email: QA_EMAIL, phone: null },
    });
    const family = await tx.family.create({ data: { name: "Courts Test Family" } });
    await tx.familyGuardian.create({ data: { familyId: family.id, guardianId: guardian.id, isPrimary: true } });

    // --- Athlete 1: Alex Test — Basketball, active Weekly plan, in Fall League ---
    const alex = await tx.athlete.create({
      data: {
        familyId: family.id,
        firstName: "Alex",
        lastName: "Test",
        dob: new Date("2016-09-01T00:00:00Z"), // ~4th grade
        grade: "4th",
        gender: "Boy",
      },
    });

    await tx.athleteMembership.create({
      data: {
        athleteId: alex.id,
        membershipPlanId: weeklyBasketball.id,
        status: "active",
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Real upcoming class session -> confirmed booking (uses the real
    // 1-session-per-week entitlement already configured on this plan).
    await tx.booking.create({
      data: { sessionId: upcomingClassSession.id, athleteId: alex.id, bookedByGuardianId: guardian.id, status: "booked" },
    });

    // Fall League: evaluation session (new, dated to match the real
    // public evaluation date), a team, and a team practice + game.
    const evalSession = await tx.session.create({
      data: {
        programId: fallLeague.id,
        startTime: new Date("2026-09-12T20:00:00.000Z"), // 3 PM CT, matches the public site
        endTime: new Date("2026-09-12T20:50:00.000Z"),
        capacity: 40,
        status: "scheduled",
      },
    });
    await tx.booking.create({
      data: { sessionId: evalSession.id, athleteId: alex.id, bookedByGuardianId: guardian.id, status: "attended" },
    });
    await tx.credit.create({
      data: {
        athleteId: alex.id,
        creditType: "fall_league_eval_credit",
        balance: 2500,
        source: "Fall League evaluation fee paid",
      },
    });

    const team = await tx.team.create({ data: { programId: fallLeague.id, name: "Courts Orange (Test Team)", division: "3rd-5th Boys" } });
    await tx.teamMember.create({ data: { teamId: team.id, athleteId: alex.id } });
    const practiceSession = await tx.session.create({
      data: { programId: fallLeague.id, teamId: team.id, startTime: new Date("2026-10-07T22:00:00.000Z"), endTime: new Date("2026-10-07T23:00:00.000Z"), capacity: 15, status: "scheduled" },
    });
    await tx.booking.create({ data: { sessionId: practiceSession.id, athleteId: alex.id, bookedByGuardianId: guardian.id, status: "booked" } });
    const gameSession = await tx.session.create({
      data: { programId: fallLeague.id, teamId: team.id, startTime: new Date("2026-10-24T15:00:00.000Z"), endTime: new Date("2026-10-24T16:00:00.000Z"), capacity: 15, status: "scheduled" },
    });
    await tx.booking.create({ data: { sessionId: gameSession.id, athleteId: alex.id, bookedByGuardianId: guardian.id, status: "booked" } });

    // Waiver signed for Alex's family (family-scope) -> covers Alex.
    await tx.waiverSignature.create({
      data: { guardianId: guardian.id, athleteId: null, waiverId: requiredWaiver.id, signedName: "Courts Test Family" },
    });

    // A second, already-full real-catalog-style session to demonstrate
    // the waitlist state honestly (capacity 1, one other seat already taken).
    const fullSession = await tx.session.create({
      data: { programId: basketballDev.id, startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), capacity: 1, status: "scheduled" },
    });
    // Filler booking under a throwaway athlete so the session is genuinely full.
    const fillerFamily = await tx.family.create({ data: { name: "(QA filler — full session)" } });
    const fillerAthlete = await tx.athlete.create({ data: { familyId: fillerFamily.id, firstName: "Filler", lastName: "Athlete", dob: new Date("2016-01-01T00:00:00Z") } });
    await tx.booking.create({ data: { sessionId: fullSession.id, athleteId: fillerAthlete.id, status: "booked" } });
    await tx.waitlistEntry.create({ data: { sessionId: fullSession.id, athleteId: alex.id, position: 1, status: "waiting" } });

    // --- Athlete 2: Sam Test — Volleyball, no plan, no waiver signed yet ---
    // (No volleyball Program/Session exists in the catalog at all yet —
    // see the report. Sam is deliberately left with no membership and no
    // bookings, which is itself the honest "nonmember, nothing booked,
    // waiver needed" test state, not a shortcut.)
    await tx.athlete.create({
      data: {
        familyId: family.id,
        firstName: "Sam",
        lastName: "Test",
        dob: new Date("2014-05-01T00:00:00Z"), // ~6th grade
        grade: "6th",
        gender: "Girl",
      },
    });
  });

  console.log("=".repeat(60));
  console.log("QA account created.");
  console.log("Email:   ", QA_EMAIL);
  console.log("Password:", password);
  console.log("=".repeat(60));
  console.log("Log in at /login with the credentials above.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
