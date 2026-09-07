import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ---------------------------------------------------------------------------
// QA environment for the Program Builder + Scheduler.
//
// Everything created here is FICTIONAL and clearly marked "[QA]" so it can
// never be mistaken for real Courts programming. Prices, dates and names are
// invented test data — no real Courts price or schedule is asserted anywhere.
//
// Idempotent: re-running deletes only rows whose program name starts with
// "[QA]" and rebuilds them. It never touches real data.
//
//   npx tsx scripts/seed-qa-programming.ts
//   npx tsx scripts/seed-qa-programming.ts --clean   (remove QA data, add none)
// ---------------------------------------------------------------------------

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const QA = "[QA]";

/// Days from today, at a wall-clock hour, as UTC — matching how the app stores
/// and renders every session time.
function at(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

async function clean() {
  const programs = await prisma.program.findMany({
    where: { name: { startsWith: QA } },
    select: { id: true },
  });
  const ids = programs.map((p) => p.id);
  if (ids.length === 0) return 0;
  // Sessions, offerings, bookings and waitlists all cascade from Program.
  await prisma.program.deleteMany({ where: { id: { in: ids } } });
  await prisma.resource.deleteMany({ where: { name: { startsWith: QA } } });
  await prisma.facilityBlock.deleteMany({ where: { note: { startsWith: QA } } });
  return ids.length;
}

async function main() {
  const cleanOnly = process.argv.includes("--clean");
  const removed = await clean();
  console.log(`Removed ${removed} QA program(s).`);
  if (cleanOnly) return;

  const staff = await prisma.staffUser.findMany({ where: { active: true }, take: 3 });
  if (staff.length === 0) throw new Error("No staff users — create one before seeding QA data.");
  const lead = staff[0];
  const second = staff[1] ?? staff[0];

  const athletes = await prisma.athlete.findMany({ take: 6, include: { family: true } });
  if (athletes.length === 0) throw new Error("No athletes — seed a family first.");

  // --- Resources, including an overlapping pair so the conflict engine has a
  // --- real containment case to detect.
  const court1 = await prisma.resource.create({
    data: { name: `${QA} Court 1`, resourceType: "court", capacity: 1, sortOrder: 1 },
  });
  const court2 = await prisma.resource.create({
    data: { name: `${QA} Court 2`, resourceType: "court", capacity: 1, sortOrder: 2 },
  });
  const halfA = await prisma.resource.create({
    data: { name: `${QA} Half Court A`, resourceType: "court", capacity: 1, sortOrder: 3 },
  });
  const drDish = await prisma.resource.create({
    data: { name: `${QA} Dr. Dish`, resourceType: "shooting_machine", capacity: 1, sortOrder: 9 },
  });
  // Court 1 physically contains Half Court A — booking either blocks the other.
  await prisma.resource.update({
    where: { id: court1.id },
    data: { overlapsResourceIds: [halfA.id] },
  });
  await prisma.resource.update({
    where: { id: halfA.id },
    data: { overlapsResourceIds: [court1.id] },
  });

  type Spec = {
    program: { name: string; type: string; sport: string | null; requiresCoach?: boolean; requiredResourceType?: string | null };
    offering: Record<string, unknown>;
    sessions: { start: Date; minutes: number; capacity: number; resourceId?: string; coachIds?: string[]; status?: "scheduled" | "cancelled"; reason?: string; dayIndex?: number; title?: string }[];
  };

  const specs: Spec[] = [
    // 1. Recurring group training — the everyday case. Published, filling up.
    {
      program: { name: `${QA} Basketball Group Training`, type: "group_training", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} 3rd–5th Grade Basketball Group Training`,
        seasonLabel: "QA Season",
        status: "published",
        publishedAt: new Date(),
        gradeMin: 3, gradeMax: 5,
        shortDescription: "Fictional QA data. Weekly skill work for 3rd–5th grade.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "per_session", priceCents: 2500, memberPriceCents: 0,
        creditRule: "uses_credit", creditsPerBooking: 1,
        defaultSessionCapacity: 8, lowSpotThreshold: 3, waitlistMode: "automatic",
        stripeTaxCode: "txcd_20060000", taxBehavior: "exclusive",
        visibleParentApp: true, visibleCoachApp: true, visibleWebsite: true,
        whatToBring: ["Water bottle", "Basketball shoes"],
      },
      sessions: Array.from({ length: 6 }, (_, i) => ({
        start: at(i * 7 + 2, 17), minutes: 60, capacity: 8,
        resourceId: court1.id, coachIds: [lead.id],
      })),
    },

    // 2. Volleyball group training — a second sport, so sport filters and
    //    head-coach scoping have something to separate.
    {
      program: { name: `${QA} Volleyball Group Training`, type: "group_training", sport: "Volleyball", requiresCoach: true },
      offering: {
        name: `${QA} 6th–8th Grade Volleyball Group Training`,
        status: "published", publishedAt: new Date(),
        gradeMin: 6, gradeMax: 8,
        shortDescription: "Fictional QA data. Weekly volleyball fundamentals.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "per_session", priceCents: 2500,
        creditRule: "member_price", memberPriceCents: 1500,
        defaultSessionCapacity: 12, waitlistMode: "automatic",
        stripeTaxCode: "txcd_20060000",
        visibleParentApp: true, visibleCoachApp: true,
        whatToBring: ["Knee pads", "Water bottle"],
      },
      sessions: Array.from({ length: 4 }, (_, i) => ({
        start: at(i * 7 + 3, 18), minutes: 60, capacity: 12,
        resourceId: court2.id, coachIds: [second.id],
      })),
    },

    // 3. Multi-day camp with single-day option.
    {
      program: { name: `${QA} Basketball Camp`, type: "camp", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Fall Break Basketball Camp`,
        status: "published", publishedAt: new Date(),
        gradeMin: 3, gradeMax: 6,
        shortDescription: "Fictional QA data. Four-day camp, full or single days.",
        scheduleKind: "multi_day", registrationMode: "multi_day", allowSingleDay: true,
        pricingModel: "multi_day_package", priceCents: 22500, singleDayPriceCents: 7500,
        creditRule: "member_price", memberPriceCents: 20000,
        capacityTotal: 40, defaultSessionCapacity: 40, lowSpotThreshold: 5,
        waitlistMode: "automatic", stripeTaxCode: "txcd_20060000",
        visibleParentApp: true, visibleWebsite: true, visibleCoachApp: true,
        whatToBring: ["Lunch", "Water bottle", "Basketball shoes"],
      },
      sessions: Array.from({ length: 4 }, (_, i) => ({
        start: at(20 + i, 8), minutes: 240, capacity: 40,
        resourceId: court1.id, coachIds: [lead.id, second.id], dayIndex: i + 1,
        title: `Day ${i + 1}`,
      })),
    },

    // 4. League season + 5. its evaluation — separate registration objects.
    {
      program: { name: `${QA} Basketball League`, type: "league", sport: "Basketball" },
      offering: {
        name: `${QA} Winter Basketball League`,
        seasonLabel: "QA Winter",
        status: "published", publishedAt: new Date(),
        gradeMin: 3, gradeMax: 8, leagueStage: "registration",
        shortDescription: "Fictional QA data. League season with evaluations and teams.",
        scheduleKind: "season", registrationMode: "season",
        pricingModel: "one_time", priceCents: 37500,
        creditRule: "separate_payment",
        defaultSessionCapacity: 60, stripeTaxCode: "txcd_20050000",
        visibleParentApp: true, visibleWebsite: true, visibleCoachApp: true,
      },
      sessions: Array.from({ length: 3 }, (_, i) => ({
        start: at(30 + i * 7, 18), minutes: 90, capacity: 60,
        resourceId: court1.id, coachIds: [lead.id], title: `League Game ${i + 1}`,
      })),
    },
    {
      program: { name: `${QA} League Evaluation`, type: "evaluation", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Winter League Evaluation`,
        status: "published", publishedAt: new Date(),
        gradeMin: 3, gradeMax: 8,
        shortDescription: "Fictional QA data. Required evaluation for league placement.",
        scheduleKind: "one_time", registrationMode: "session",
        pricingModel: "one_time", priceCents: 2500,
        creditRule: "separate_payment",
        defaultSessionCapacity: 40, stripeTaxCode: "txcd_20050000",
        visibleParentApp: true, visibleCoachApp: true,
      },
      sessions: [{ start: at(25, 17), minutes: 90, capacity: 40, resourceId: court2.id, coachIds: [lead.id] }],
    },

    // 6. Private training. 7. Guided Dr. Dish. 8. Self-service Dr. Dish.
    {
      program: { name: `${QA} Private Training`, type: "private_training", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Private Basketball Training`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. One-on-one coaching.",
        scheduleKind: "one_time", registrationMode: "session",
        pricingModel: "per_session", priceCents: 8000, memberPriceCents: 6500,
        creditRule: "member_price", defaultSessionCapacity: 1,
        stripeTaxCode: "txcd_20060000", visibleParentApp: true, visibleCoachApp: true,
      },
      sessions: [{ start: at(4, 16), minutes: 60, capacity: 1, resourceId: court2.id, coachIds: [lead.id] }],
    },
    {
      program: { name: `${QA} Guided Dr. Dish`, type: "guided_dr_dish", sport: "Basketball", requiresCoach: true, requiredResourceType: "shooting_machine" },
      offering: {
        name: `${QA} Guided Dr. Dish Session`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Coach-led shooting work.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "per_session", priceCents: 4000, memberPriceCents: 3000,
        creditRule: "member_price", defaultSessionCapacity: 1,
        stripeTaxCode: "txcd_20060000", visibleParentApp: true, visibleCoachApp: true,
      },
      sessions: [
        { start: at(5, 15), minutes: 30, capacity: 1, resourceId: drDish.id, coachIds: [lead.id] },
        { start: at(12, 15), minutes: 30, capacity: 1, resourceId: drDish.id, coachIds: [lead.id] },
      ],
    },
    {
      program: { name: `${QA} Self-Service Dr. Dish`, type: "self_serve_dr_dish", sport: "Basketball", requiredResourceType: "shooting_machine" },
      offering: {
        name: `${QA} Self-Service Dr. Dish`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Independent machine time, no coach.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "per_session", priceCents: 2000,
        creditRule: "separate_payment", defaultSessionCapacity: 1,
        stripeTaxCode: "txcd_20030000", visibleParentApp: true,
      },
      sessions: [{ start: at(5, 16), minutes: 30, capacity: 1, resourceId: drDish.id }],
    },

    // 9. Open gym. 10. Court rental.
    {
      program: { name: `${QA} Open Gym`, type: "open_gym", sport: "Multi-Sport" },
      offering: {
        name: `${QA} Friday Open Gym`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Drop-in facility access.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "free", priceCents: 0, creditRule: "free",
        defaultSessionCapacity: 30, lowSpotThreshold: 5,
        visibleParentApp: true, visibleWebsite: true,
      },
      sessions: [{ start: at(6, 19), minutes: 120, capacity: 30, resourceId: court2.id }],
    },
    {
      program: { name: `${QA} Court Rental`, type: "court_rental", sport: "General" },
      offering: {
        name: `${QA} Hourly Court Rental`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Rent a court by the hour.",
        scheduleKind: "one_time", registrationMode: "session",
        pricingModel: "per_session", priceCents: 6000,
        creditRule: "separate_payment", defaultSessionCapacity: 1,
        stripeTaxCode: "txcd_20030000", visibleWebsite: true, visibleParentApp: true,
      },
      sessions: [{ start: at(7, 20), minutes: 60, capacity: 1, resourceId: halfA.id }],
    },

    // 11. Special event, paid, capacity 30.
    {
      program: { name: `${QA} Special Event`, type: "special_event", sport: "Volleyball" },
      offering: {
        name: `${QA} Volleyween`,
        status: "published", publishedAt: new Date(),
        gradeMin: 4, gradeMax: 8,
        shortDescription: "Fictional QA data. Costume volleyball night.",
        fullDescription: "Fictional QA data used to exercise the event builder end to end.",
        scheduleKind: "one_time", registrationMode: "offering",
        pricingModel: "one_time", priceCents: 2000,
        creditRule: "separate_payment", capacityTotal: 30, defaultSessionCapacity: 30,
        lowSpotThreshold: 5, waitlistMode: "automatic",
        stripeTaxCode: "txcd_20050000",
        visibleParentApp: true, visibleWebsite: true, visibleCoachApp: true,
        whatToBring: ["Costume", "Knee pads", "Water bottle"],
      },
      sessions: [{ start: at(14, 18), minutes: 120, capacity: 30, resourceId: court1.id, coachIds: [second.id] }],
    },

    // 12. DRAFT with sessions — must never reach a parent-facing surface.
    {
      program: { name: `${QA} Draft Clinic`, type: "skills_clinic", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Unpublished Shooting Clinic`,
        status: "draft",
        gradeMin: 5, gradeMax: 8,
        shortDescription: "Fictional QA data. Should be invisible to families.",
        scheduleKind: "one_time", registrationMode: "offering",
        pricingModel: "one_time", priceCents: 4500,
        creditRule: "separate_payment", defaultSessionCapacity: 16,
        visibleParentApp: true, visibleWebsite: true,
      },
      sessions: [{ start: at(9, 17), minutes: 90, capacity: 16, resourceId: court2.id, coachIds: [lead.id] }],
    },

    // 13. Paid, NO Stripe and NO tax code — must be blocked from publishing.
    {
      program: { name: `${QA} Broken Checkout Clinic`, type: "skills_clinic", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Clinic Missing Stripe Setup`,
        status: "draft",
        shortDescription: "Fictional QA data. Paid but deliberately unconnected to Stripe.",
        scheduleKind: "one_time", registrationMode: "offering",
        pricingModel: "one_time", priceCents: 5000,
        creditRule: "separate_payment", defaultSessionCapacity: 10,
        visibleParentApp: true,
      },
      sessions: [{ start: at(10, 17), minutes: 60, capacity: 10, resourceId: court2.id, coachIds: [lead.id] }],
    },

    // 14. Registration opening in the FUTURE — parents see "Coming Soon".
    {
      program: { name: `${QA} Future Registration Camp`, type: "camp", sport: "Volleyball", requiresCoach: true },
      offering: {
        name: `${QA} Winter Volleyball Camp`,
        status: "published", publishedAt: new Date(),
        gradeMin: 4, gradeMax: 8,
        shortDescription: "Fictional QA data. Registration opens later.",
        scheduleKind: "multi_day", registrationMode: "multi_day",
        registrationOpensAt: at(30, 8),
        pricingModel: "multi_day_package", priceCents: 18000,
        creditRule: "separate_payment", capacityTotal: 24, defaultSessionCapacity: 24,
        stripeTaxCode: "txcd_20060000", visibleParentApp: true, visibleWebsite: true,
      },
      sessions: Array.from({ length: 2 }, (_, i) => ({
        start: at(45 + i, 9), minutes: 180, capacity: 24,
        resourceId: court2.id, coachIds: [second.id], dayIndex: i + 1,
      })),
    },

    // 15. Registration CLOSED — visible, but nobody new can register.
    {
      program: { name: `${QA} Closed Registration Clinic`, type: "skills_clinic", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Clinic With Registration Closed`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Deadline has passed.",
        scheduleKind: "one_time", registrationMode: "offering",
        registrationClosesAt: at(-1, 12),
        pricingModel: "one_time", priceCents: 3500,
        creditRule: "separate_payment", defaultSessionCapacity: 12,
        stripeTaxCode: "txcd_20060000", visibleParentApp: true,
      },
      sessions: [{ start: at(11, 17), minutes: 60, capacity: 12, resourceId: court2.id, coachIds: [lead.id] }],
    },

    // 16. A cancelled session, with a make-up scheduled after it.
    {
      program: { name: `${QA} Rescheduled Training`, type: "group_training", sport: "Basketball", requiresCoach: true },
      offering: {
        name: `${QA} Training With A Cancelled Week`,
        status: "published", publishedAt: new Date(),
        gradeMin: 3, gradeMax: 5,
        shortDescription: "Fictional QA data. One week cancelled, make-up added.",
        scheduleKind: "recurring", registrationMode: "session",
        pricingModel: "per_session", priceCents: 2500,
        creditRule: "uses_credit", defaultSessionCapacity: 8,
        stripeTaxCode: "txcd_20060000", visibleParentApp: true, visibleCoachApp: true,
      },
      sessions: [
        { start: at(8, 17), minutes: 60, capacity: 8, resourceId: court2.id, coachIds: [lead.id], status: "cancelled", reason: "QA: facility maintenance" },
        { start: at(15, 17), minutes: 60, capacity: 8, resourceId: court2.id, coachIds: [lead.id], title: "Make-up session" },
      ],
    },

    // 17. Internal only — occupies the facility, reaches nobody.
    {
      program: { name: `${QA} Staff Practice`, type: "open_gym", sport: "General" },
      offering: {
        name: `${QA} Internal Staff Practice`,
        status: "published", publishedAt: new Date(),
        shortDescription: "Fictional QA data. Internal only — must not appear publicly.",
        scheduleKind: "one_time", registrationMode: "session",
        pricingModel: "free", creditRule: "free", defaultSessionCapacity: 20,
        internalOnly: true, visibleParentApp: false, visibleWebsite: false, visibleCoachApp: true,
      },
      sessions: [{ start: at(13, 21), minutes: 60, capacity: 20, resourceId: court1.id }],
    },
  ];

  for (const spec of specs) {
    const program = await prisma.program.create({
      data: {
        name: spec.program.name,
        programType: spec.program.type as never,
        sport: spec.program.sport,
        requiresCoach: spec.program.requiresCoach ?? false,
        requiredResourceType: spec.program.requiredResourceType ?? null,
      },
    });

    const sessionStarts = spec.sessions.map((s) => s.start);
    const offering = await prisma.offering.create({
      data: {
        programId: program.id,
        createdById: lead.id,
        startDate: sessionStarts.length ? new Date(Math.min(...sessionStarts.map((d) => d.getTime()))) : null,
        endDate: sessionStarts.length ? new Date(Math.max(...sessionStarts.map((d) => d.getTime()))) : null,
        ...(spec.offering as object),
      } as never,
    });

    for (const s of spec.sessions) {
      const session = await prisma.session.create({
        data: {
          programId: program.id,
          offeringId: offering.id,
          resourceId: s.resourceId ?? null,
          startTime: s.start,
          endTime: new Date(s.start.getTime() + s.minutes * 60_000),
          capacity: s.capacity,
          status: s.status ?? "scheduled",
          cancellationReason: s.reason ?? null,
          cancelledAt: s.status === "cancelled" ? new Date() : null,
          dayIndex: s.dayIndex ?? null,
          title: s.title ?? null,
        },
      });
      // Deduped: with a small staff roster `lead` and `second` can be the same
      // person, and SessionCoach is keyed on (session, staff).
      for (const [i, coachId] of [...new Set(s.coachIds ?? [])].entries()) {
        await prisma.sessionCoach.create({
          data: { sessionId: session.id, staffUserId: coachId, role: i === 0 ? "lead" : "assistant" },
        });
      }
    }
    console.log(`  ${spec.program.name} → ${spec.sessions.length} session(s)`);
  }

  // --- A FULL session with a waitlist, so the promotion flow has real state.
  const groupTraining = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: `${QA} 3rd–5th` } },
    include: { sessions: { orderBy: { startTime: "asc" } } },
  });
  const fullSession = groupTraining.sessions[0];
  await prisma.session.update({ where: { id: fullSession.id }, data: { capacity: 2 } });

  for (const athlete of athletes.slice(0, 2)) {
    await prisma.booking.create({
      data: { sessionId: fullSession.id, athleteId: athlete.id, status: "booked", creditSource: "QA seed" },
    });
  }
  for (const [i, athlete] of athletes.slice(2, 5).entries()) {
    await prisma.waitlistEntry.create({
      data: { sessionId: fullSession.id, athleteId: athlete.id, position: i + 1, status: "waiting" },
    });
  }
  console.log(`  Full session with 2 booked + 3 waiting: ${fullSession.id}`);

  // --- A facility closure that a scheduling attempt must respect.
  await prisma.facilityBlock.create({
    data: {
      resourceId: null,
      startTime: at(17, 0),
      endTime: at(17, 23, 59),
      reason: "holiday",
      note: `${QA} Fictional holiday closure`,
      createdById: lead.id,
    },
  });
  console.log("  Whole-facility closure created.");

  const counts = {
    programs: await prisma.program.count({ where: { name: { startsWith: QA } } }),
    offerings: await prisma.offering.count({ where: { name: { startsWith: QA } } }),
    sessions: await prisma.session.count({ where: { program: { name: { startsWith: QA } } } }),
  };
  console.log("\nQA programming ready:", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
