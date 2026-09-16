// Real eval-attendance data Melissa sent, first batch (2026-09-16). Hand-typed
// from her pasted sign-in-sheet export rather than parsed generically — the
// column layout wasn't consistent enough across rows to trust a positional
// parser with real data. Kept as a historical record; re-run is safe
// (skips a name pair that's already imported).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SOURCE = "eval_attendance_batch_1_2026-09-16";

const rows = [
  { firstName: "Rhys", lastName: "Carle", grade: "3rd", gender: "Boy", school: "Jordan Elementary", guardianName: "Melissa Carle", guardianEmail: "melissakcarle@gmail.com", guardianPhone: "(301) 281-5811", notes: "$25 eval fee paid, confirmed by Melissa on 9/6/2026." },
  { firstName: "Copeland", lastName: "Duke", grade: "3rd", gender: "Boy", school: null, guardianName: "Tara Duke", guardianEmail: "tara.duke15@gmail.com", guardianPhone: "(615) 944-5944", notes: "Tara Duke paid $50 total for Tenley + Copeland; $25 allocated to this player. Confirmed by Melissa." },
  { firstName: "Mason", lastName: "Edwards", grade: "3rd", gender: "Boy", school: "NES", guardianName: "Trish Edwards", guardianEmail: "edwards.trish1@gmail.com", guardianPhone: "(845) 527-0178", notes: "Sibling: Logan Edwards. Prior NextGen summer league / Nolensville youth basketball. Practice pref: Thursday only." },
  { firstName: "Tanner", lastName: "Friend", grade: "3rd", gender: "Boy", school: "Nolensville Elementary", guardianName: "Cody Friend", guardianEmail: "CodyLFriend@gmail.com", guardianPhone: "(949) 735-7055", notes: null },
  { firstName: "Marshall", lastName: "Miltimore", grade: "3rd", gender: "Boy", school: "Jordan Elementary", guardianName: "Cyndel Miltimore", guardianEmail: "cyndelmiltimore@gmail.com", guardianPhone: "(317) 607-5072", notes: null },
  { firstName: "Logan", lastName: "Edwards", grade: "4th", gender: "Boy", school: "NES", guardianName: "Trish Edwards", guardianEmail: "edwards.trish1@gmail.com", guardianPhone: "(845) 527-0178", notes: "Sibling: Mason Edwards." },
  { firstName: "Grayson", lastName: "Green", grade: "4th", gender: "Boy", school: null, guardianName: "Ronya Green", guardianEmail: "ronyagreen@gmail.com", guardianPhone: "(210) 867-5446", notes: "Prior NextGen Summer League." },
  { firstName: "Charlie", lastName: "Hammond", grade: "6th", gender: "Boy", school: "BMS", guardianName: "Melissa Hammond", guardianEmail: "mklevy04@hotmail.com", guardianPhone: null, notes: null },
  { firstName: "Hunter", lastName: "Rumpf", grade: "6th", gender: "Boy", school: null, guardianName: "Jeremy Rumpf", guardianEmail: "jlr1167@yahoo.com", guardianPhone: "(908) 246-7984", notes: "Potential schedule conflict: travel soccer." },
  { firstName: "Michael", lastName: "Sha", grade: "6th", gender: "Boy", school: "Mill Creek Middle", guardianName: "Ying huang", guardianEmail: "gz_1998@hotmail.com", guardianPhone: "(610) 914-8016", notes: "NextGen Rollover. Prefers Sat afternoon game, Thursday night practice." },
  { firstName: "Leo", lastName: "Taylor", grade: "6th", gender: "Boy", school: "Mill Creek Middle", guardianName: "Elizabeth Taylor", guardianEmail: "ectaylor27@gmail.com", guardianPhone: "(352) 262-7135", notes: "Baseball tournament conflict weekend of Oct 24." },
  { firstName: "Ethan", lastName: "Gwydir", grade: "7th", gender: "Boy", school: "MCMS", guardianName: "Daniel Gwydir", guardianEmail: "dan.gwydir@gmail.com", guardianPhone: "(615) 268-2193", notes: null },
  { firstName: "Charlie", lastName: "Jenkins", grade: "7th", gender: "Boy", school: null, guardianName: "Jeremy Jenkins", guardianEmail: "jeremyjenkins83@gmail.com", guardianPhone: "(615) 815-5390", notes: "Saturday mornings conflict with baseball/soccer until ~3pm." },
  { firstName: "Kingston", lastName: "Victory", grade: "7th", gender: "Boy", school: "Mill Creek Middle School", guardianName: "Ashley Victory", guardianEmail: "aerkelly@gmail.com", guardianPhone: "(615) 491-8988", notes: "NextGen Rollover." },
  { firstName: "Kyle", lastName: "Hanson", grade: "Homeschool", gender: "Boy", school: null, guardianName: "Celeste Hanson", guardianEmail: null, guardianPhone: "6154031713", notes: null },
];

async function main() {
  let created = 0;
  let skippedExisting = 0;
  let autoLinked = 0;

  for (const row of rows) {
    const already = await prisma.evalAttendanceRecord.findFirst({
      where: { firstName: { equals: row.firstName, mode: "insensitive" }, lastName: { equals: row.lastName, mode: "insensitive" }, source: SOURCE },
    });
    if (already) {
      skippedExisting++;
      continue;
    }

    // If a matching Athlete already exists (e.g. an existing Courts family),
    // link immediately — no need to wait for a future athlete-creation event.
    const existingAthletes = await prisma.athlete.findMany({
      where: { firstName: { equals: row.firstName, mode: "insensitive" }, lastName: { equals: row.lastName, mode: "insensitive" } },
    });
    const matchedAthleteId = existingAthletes.length === 1 ? existingAthletes[0].id : null;

    await prisma.evalAttendanceRecord.create({
      data: {
        firstName: row.firstName,
        lastName: row.lastName,
        grade: row.grade,
        gender: row.gender,
        school: row.school,
        guardianName: row.guardianName,
        guardianEmail: row.guardianEmail,
        guardianPhone: row.guardianPhone,
        notes: row.notes,
        source: SOURCE,
        matchedAthleteId,
        matchedAt: matchedAthleteId ? new Date() : null,
      },
    });
    created++;
    if (matchedAthleteId) autoLinked++;
  }

  console.log(`Created ${created} record(s), ${autoLinked} auto-linked to an existing athlete, ${skippedExisting} already existed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
