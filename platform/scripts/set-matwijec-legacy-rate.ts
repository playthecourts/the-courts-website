// Same writes as os/nextgen/actions.ts's setLegacyRate — run directly since
// that action needs a real staff session this script doesn't have. Unlocks
// the real "Complete Your Transfer — $165.00/mo" checkout button for Kennedy
// Matwijec on /my-courts/memberships; the family still enters their own card.
// Kept as a historical record.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const GUARDIAN_ID = "56c8c27b-7fbb-47f8-a025-7b72d3b09ea7"; // Mackenzie Matwijec
const LEGACY_RATE_CENTS = 16500; // $165.00/mo through Dec 31, 2026, then Founders' real $185

async function main() {
  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: GUARDIAN_ID } });
  if (guardian.nextGenStatus !== "current_nextgen") {
    throw new Error("Not a current_nextgen self-report — refusing to set a legacy rate.");
  }

  await prisma.guardian.update({
    where: { id: GUARDIAN_ID },
    data: { legacyRateCents: LEGACY_RATE_CENTS, nextGenVerification: "verified" },
  });

  await prisma.auditLog.create({
    data: {
      staffUserId: (await prisma.staffUser.findFirstOrThrow({ where: { role: { in: ["owner", "admin"] } } })).id,
      action: "set_nextgen_legacy_rate",
      entityType: "guardian",
      entityId: GUARDIAN_ID,
      metadata: { legacyRateCents: LEGACY_RATE_CENTS, note: "Kennedy Matwijec — $165/mo through Dec 31 2026, then Founders $185" },
    },
  });

  console.log(`Set legacyRateCents=${LEGACY_RATE_CENTS} and verified Mackenzie Matwijec's NextGen status.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
