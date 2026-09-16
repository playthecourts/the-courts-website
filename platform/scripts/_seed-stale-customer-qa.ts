import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";

const EMAIL = "qa-stalecust-20260916@example.com";
const PASSWORD = "QaCheck!2026x9";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supa = createClient(supabaseUrl, anonKey);

  const { data, error } = await supa.auth.signUp({ email: EMAIL, password: PASSWORD });
  if (error || !data.user) throw error ?? new Error("signup failed");

  // Reproduce Melissa's exact scenario (a soft-deleted Stripe customer)
  // rather than reusing her real id, which is already claimed by her real
  // guardian row under a unique constraint — create a fresh customer, then
  // delete it so it's in the same "deleted: true" state hers is in.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const throwawayCustomer = await stripe.customers.create({ email: EMAIL, name: "QA StaleCust" });
  await stripe.customers.del(throwawayCustomer.id);

  const guardian = await prisma.guardian.create({
    data: {
      authId: data.user.id,
      email: EMAIL,
      name: "QA StaleCust",
      stripeCustomerId: throwawayCustomer.id,
    },
  });

  const family = await prisma.family.create({ data: { name: "QA StaleCust Family" } });
  await prisma.familyGuardian.create({ data: { guardianId: guardian.id, familyId: family.id } });
  const athlete = await prisma.athlete.create({
    data: {
      familyId: family.id,
      firstName: "Qa",
      lastName: "Stalecust",
      dob: new Date("2016-01-15"),
      grade: "5th",
      gender: "Boy",
    },
  });

  console.log("Created guardian", guardian.id, "athlete", athlete.id, "email", EMAIL);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
