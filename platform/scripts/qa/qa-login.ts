import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import crypto from "node:crypto";

// Creates a signed-in-able QA parent for the [QA] Carter family, through the
// same anon-key signup path a real parent uses. Follows the existing pattern in
// scripts/seed-qa-account.ts. Password is printed once, never written to disk.

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const EMAIL = "qa-profile@playthecourts.com";

async function main() {
  const password = crypto.randomBytes(12).toString("base64url");
  const { data, error } = await supabase.auth.signUp({ email: EMAIL, password });
  if (error) throw new Error(error.message);

  const family = await prisma.family.findFirstOrThrow({ where: { name: "[QA] Carter Family" } });

  const guardian = await prisma.guardian.upsert({
    where: { email: EMAIL },
    create: { authId: data.user!.id, name: "[QA] Dana Carter (login)", email: EMAIL, phone: "615-555-0101" },
    update: { authId: data.user!.id },
  });

  await prisma.familyGuardian.upsert({
    where: { familyId_guardianId: { familyId: family.id, guardianId: guardian.id } },
    create: { familyId: family.id, guardianId: guardian.id, isPrimary: true, relationship: "Mom" },
    update: {},
  });

  console.log(`EMAIL=${EMAIL}`);
  console.log(`PASSWORD=${password}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
