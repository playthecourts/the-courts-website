import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const SOURCE = "165_list_2026-09-16";
const LEGACY_RATE_CENTS = 16500;

// Verbatim from the official NextGen list, deduped by email.
const LIST: { name: string; email: string }[] = [
  { name: "Ciji Wilkes", email: "ciji_crawford@hotmail.com" },
  { name: "Melissa Carle", email: "melissakcarle@gmail.com" },
  { name: "Cyndel Miltimore", email: "cyndelmiltimore@gmail.com" },
  { name: "Jennifer mcshsne", email: "jennyannmcshane@gmail.com" },
  { name: "Megan Fahey", email: "megfahey26@gmail.com" },
  { name: "James Theler", email: "jrtheler@gmail.com" },
  { name: "Daniel Derner", email: "ddderner@gmail.com" },
  { name: "Dheerja Sharma", email: "dheerja.gupta@gmail.com" },
  { name: "Sarah Walker", email: "sarahbwalker85@gmail.com" },
  { name: "Mindy Campbell", email: "mindymae54@gmail.com" },
  { name: "Ashley Victory", email: "aerkelly@gmail.com" },
  { name: "Keith Smith", email: "keithsmith33@yahoo.com" },
  { name: "Divya Salhan", email: "salhandivya@gmail.com" },
  { name: "Amanda  Fuller", email: "aboone12345@yahoo.com" },
  { name: "Trisha Madsen", email: "tj4iu@hotmail.com" },
  { name: "Jonathan Furlong", email: "gfurlong323@yahoo.com" },
  { name: "William Bennett", email: "wjlbennett@gmail.com" },
  { name: "Anthony J Caduff", email: "anthonycaduff@gmail.com" },
  { name: "Indu Padmanabhan", email: "indu611@gmail.com" },
  { name: "Elizabeth H Youssefi", email: "ehyoussefi@gmail.com" },
  { name: "Miranda S West", email: "mirandaswest@gmail.com" },
  { name: "Amy Forst", email: "amy.forst2@gmail.com" },
  { name: "Jacqueline A Peters", email: "jackie.a.peters@gmail.com" },
  { name: "Bethany Scully", email: "bwscully@gmail.com" },
  { name: "Matthew Taylor", email: "mtaylor@bluewiregroup.com" },
  { name: "Steve Wisinski", email: "wisinskisteve@gmail.com" },
  { name: "Jennifer Pence", email: "jennpence1007@gmail.com" },
  { name: "Amy Ervin", email: "amywhittervin@gmail.com" },
  { name: "Dennis Glynn", email: "organicdiet@outlook.com" },
  { name: "Julie Johnson", email: "jajanko21@gmail.com" },
  { name: "Darris Wade", email: "d_money2k4@yahoo.com" },
  { name: "Sarah Jimenez", email: "myst1216@gmail.com" },
  { name: "Gary Avnaim", email: "garyavnaim@gmail.com" },
  { name: "Cody Friend", email: "codylfriend@gmail.com" },
  { name: "Jennifer Lundie", email: "jennifer.lundie@yahoo.com" },
  { name: "Mickel Smith", email: "mssmith1031@gmail.com" },
  { name: "Kim west", email: "nursekdh27@yahoo.com" },
];

async function main() {
  const seen = new Set<string>();
  const deduped = LIST.filter((row) => {
    const key = row.email.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let created = 0;
  let backfilled = 0;

  for (const row of deduped) {
    const existing = await prisma.nextGenRecord.findFirst({
      where: { email: { equals: row.email, mode: "insensitive" }, source: SOURCE },
    });
    if (existing) continue;

    const record = await prisma.nextGenRecord.create({
      data: { name: row.name, email: row.email, legacyRateCents: LEGACY_RATE_CENTS, source: SOURCE },
    });
    created++;

    // Backfill the link for the 2 guardians already matched by exact email
    // earlier this session, so they don't show up as "unmatched" needing
    // action — the record and the real Guardian.legacyRateCents already
    // agree (both $165), this just closes the loop on the new table.
    const matchedGuardian = await prisma.guardian.findFirst({
      where: {
        email: { equals: row.email, mode: "insensitive" },
        nextGenVerification: "verified",
        legacyRateCents: LEGACY_RATE_CENTS,
      },
    });
    if (matchedGuardian) {
      await prisma.nextGenRecord.update({
        where: { id: record.id },
        data: { matchedGuardianId: matchedGuardian.id, matchedAt: new Date() },
      });
      backfilled++;
    }
  }

  console.log(`Imported ${created} new NextGenRecord rows (${deduped.length - created} already existed).`);
  console.log(`Backfilled ${backfilled} already-matched links.`);
}

main().finally(() => prisma.$disconnect());
