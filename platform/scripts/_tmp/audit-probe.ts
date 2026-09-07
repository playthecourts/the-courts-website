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
    memberships: await prisma.athleteMembership.count(),
    waivers: await prisma.waiver.count(),
    evaluations: await prisma.evaluation.count(),
    credits: await prisma.credit.count(),
    audit: await prisma.auditLog.count(),
    comms: await prisma.communication.count(),
    coverage: await prisma.coverageRequest.count(),
  }, null, 2));
  console.log("STAFF:", JSON.stringify(await prisma.staffUser.findMany({ select: { name: true, email: true, role: true, sports: true, active: true } }), null, 2));
  console.log("PROGRAMS:", JSON.stringify(await prisma.program.findMany({ select: { name: true, programType: true, sport: true, active: true, priceCents: true, stripePriceId: true as never } }).catch(() => prisma.program.findMany({ select: { name: true, programType: true, sport: true, active: true, priceCents: true } })), null, 2));
  console.log("RESOURCES:", JSON.stringify(await prisma.resource.findMany({ select: { name: true, resourceType: true, capacity: true } }), null, 2));
  console.log("PLANS:", JSON.stringify(await prisma.membershipPlan.findMany({ select: { name: true, priceCents: true, billingInterval: true, stripePriceId: true } }), null, 2));
  console.log("FAMILIES:", JSON.stringify(await prisma.family.findMany({ select: { name: true, athletes: { select: { firstName: true, grade: true } } } }), null, 2));
}
main().finally(() => prisma.$disconnect());
