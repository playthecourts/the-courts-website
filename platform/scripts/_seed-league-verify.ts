import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import crypto from "node:crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const QA_EMAIL = `qa-league-verify-${Date.now()}@playthecourts.com`;

function randomPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function main() {
  const password = randomPassword();
  const { data, error } = await supabase.auth.signUp({ email: QA_EMAIL, password });
  if (error) throw new Error(`Supabase signUp failed: ${error.message}`);
  if (!data.user) throw new Error("Supabase signUp returned no user.");

  const requiredWaivers = await prisma.waiver.findMany({ where: { required: true } });

  await prisma.$transaction(async (tx) => {
    const guardian = await tx.guardian.create({
      data: { authId: data.user!.id, name: "League Verify QA", email: QA_EMAIL, phone: null },
    });
    const family = await tx.family.create({ data: { name: "League Verify QA Family" } });
    await tx.familyGuardian.create({ data: { familyId: family.id, guardianId: guardian.id, isPrimary: true } });
    const athlete = await tx.athlete.create({
      data: {
        familyId: family.id,
        firstName: "Verify",
        lastName: "QA",
        dob: new Date("2016-09-01T00:00:00Z"),
        grade: "4th",
        gender: "Boy",
      },
    });
    for (const w of requiredWaivers) {
      const sig = await tx.waiverSignature.create({
        data: { guardianId: guardian.id, athleteId: null, waiverId: w.id, signedName: "League Verify QA" },
      });
      await tx.waiverSignatureAthlete.create({ data: { waiverSignatureId: sig.id, athleteId: athlete.id } });
    }
  });

  console.log("EMAIL:", QA_EMAIL);
  console.log("PASSWORD:", password);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
