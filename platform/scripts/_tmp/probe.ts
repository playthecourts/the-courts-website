import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
async function main() {
  console.log(JSON.stringify({
    guardians: await prisma.guardian.count(),
    families: await prisma.family.count(),
    athletes: await prisma.athlete.count(),
    staff: await prisma.staffUser.count(),
    programs: await prisma.program.count(),
    sessions: await prisma.session.count(),
    bookings: await prisma.booking.count(),
    teams: await prisma.team.count(),
    resources: await prisma.resource.count(),
    plans: await prisma.membershipPlan.count(),
    waivers: await prisma.waiver.count(),
  }, null, 2));
  console.log("PROGRAMS:", JSON.stringify(await prisma.program.findMany({ select: { name: true, programType: true, sport: true, active: true } })));
  console.log("STAFF:", JSON.stringify(await prisma.staffUser.findMany({ select: { name: true, email: true, role: true } })));
  console.log("RESOURCES:", JSON.stringify(await prisma.resource.findMany({ select: { name: true, resourceType: true } })));
  console.log("TEAMS:", JSON.stringify(await prisma.team.findMany({ select: { name: true, division: true } })));
}
main().finally(() => prisma.$disconnect());
