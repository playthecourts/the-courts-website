import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import crypto from "node:crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const EMAIL = "qa-league-browser-test@playthecourts.com";

function randomPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

async function main() {
  const existing = await prisma.guardian.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("Already exists, guardian id:", existing.id, "(delete manually if you need a fresh one)");
    return;
  }

  const password = randomPassword();
  const { data, error } = await supabase.auth.signUp({ email: EMAIL, password });
  if (error) throw new Error(`Supabase signUp failed: ${error.message}`);
  if (!data.user) throw new Error("Supabase signUp returned no user.");

  const guardian = await prisma.guardian.create({
    data: { authId: data.user.id, name: "League Browser Test", email: EMAIL, phone: null },
  });
  const family = await prisma.family.create({ data: { name: "League Browser Test Family" } });
  await prisma.familyGuardian.create({ data: { familyId: family.id, guardianId: guardian.id, isPrimary: true } });

  // No membership on purpose — this is exactly the athlete that should
  // trigger the "needsMembership" bundled-Weekly-subscription path.
  const athlete = await prisma.athlete.create({
    data: { familyId: family.id, firstName: "Bundletest", lastName: "Athlete", dob: new Date("2016-01-01T00:00:00Z"), grade: "5th" },
  });

  const requiredWaivers = await prisma.waiver.findMany({ where: { required: true } });
  for (const w of requiredWaivers) {
    await prisma.waiverSignature.create({
      data: { guardianId: guardian.id, athleteId: null, waiverId: w.id, signedName: "League Browser Test" },
    });
  }

  console.log("=".repeat(60));
  console.log("Email:   ", EMAIL);
  console.log("Password:", password);
  console.log("Athlete: ", athlete.firstName, athlete.id, "(no membership)");
  console.log("=".repeat(60));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
