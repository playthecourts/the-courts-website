// Removes one confirmed bot signup (random-string name, gibberish athlete,
// no registrations/memberships/payments). Guarded by exact id + email so a
// re-run can't touch anything else. Supabase Auth user left as-is (no
// service-role key here). Kept as a historical record.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const ID = "6b11b926-fe06-4781-b753-af99c74992d3";
async function main() {
  const g = await prisma.guardian.findUnique({
    where: { id: ID },
    include: { families: { include: { family: { include: { athletes: { include: { registrations: true, memberships: true } } } } } } },
  });
  if (!g) return console.log("Already gone.");
  if (g.email !== "k.i.wub.ok251@gmail.com") throw new Error("Email mismatch — refusing.");
  const athletes = g.families.flatMap((f) => f.family.athletes);
  if (athletes.some((a) => a.registrations.length || a.memberships.length)) throw new Error("Has registrations/memberships — refusing.");
  for (const f of g.families) await prisma.family.delete({ where: { id: f.familyId } });
  await prisma.guardian.delete({ where: { id: ID } });
  console.log("Removed. Guardians remaining:", await prisma.guardian.count());
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
