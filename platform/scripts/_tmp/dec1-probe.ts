import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const t = (d: Date) => d.toISOString().slice(11, 16);
async function main() {
  const s = await prisma.session.findMany({
    where: { startTime: { gte: new Date("2026-12-01T00:00:00Z"), lt: new Date("2026-12-02T00:00:00Z") } },
    include: { offering: { select: { id: true, name: true } }, program: { select: { name: true, programType: true } }, resource: { select: { name: true } }, extraResources: { include: { resource: { select: { name: true } } } }, coaches: { include: { staff: { select: { name: true } } } }, bookings: { where: { status: { not: "cancelled" } }, select: { status: true, athlete: { select: { firstName: true, lastName: true } } } } },
    orderBy: { startTime: "asc" },
  });
  for (const x of s) console.log(`${t(x.startTime)}–${t(x.endTime)} [${x.status}] ${x.offering?.name ?? x.program.name} (${x.program.programType}) id=${x.id} series=${x.seriesId} title=${x.title} court=${x.resource?.name}${x.extraResources.map(r=>"+"+r.resource.name).join("")} coaches=${x.coaches.map(c=>c.staff.name).join(",")} booked=${x.bookings.length} ${x.bookings.map(b=>`${b.athlete.firstName} ${b.athlete.lastName}`).join(", ")}`);
  console.log(await prisma.facilityBlock.findMany({ where: { startTime: { lt: new Date("2026-12-02T00:00:00Z") }, endTime: { gt: new Date("2026-12-01T00:00:00Z") } }, select: { note: true, startTime: true, endTime: true, resourceId: true } }));
  console.log(await prisma.resourceReservation.findMany({ where: { status: "confirmed", startTime: { lt: new Date("2026-12-02T00:00:00Z") }, endTime: { gt: new Date("2026-12-01T00:00:00Z") } } }));
}
main().finally(() => prisma.$disconnect());
