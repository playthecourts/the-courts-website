// One-off grant, same writes the "Drop-In Credits" admin UI performs
// (src/app/os/athletes/actions.ts's grantDropInCredits) — run directly since
// that action needs a real staff session this script doesn't have. Kept as a
// historical record of the grant.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ATHLETE_ID = "821639b0-4b78-45ee-a34d-94eb8da23816"; // Benjamin Hessler
const QUANTITY = 2;
const NOTE = "Comped by Melissa";

async function main() {
  const existing = await prisma.credit.findFirst({
    where: { athleteId: ATHLETE_ID, creditType: "drop_in_pack", source: { contains: NOTE } },
  });
  if (existing) {
    console.log("Already granted — not creating a duplicate.");
    return;
  }

  const credit = await prisma.credit.create({
    data: {
      athleteId: ATHLETE_ID,
      creditType: "drop_in_pack",
      balance: QUANTITY,
      status: "issued",
      source: `Granted by Melissa — ${NOTE}`,
    },
  });

  await prisma.creditLedgerEntry.create({
    data: {
      creditId: credit.id,
      delta: QUANTITY,
      balanceAfter: QUANTITY,
      reason: `Staff grant — ${NOTE}`,
    },
  });

  console.log(`Granted ${QUANTITY} drop-in credits to Benjamin Hessler. Credit id: ${credit.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
