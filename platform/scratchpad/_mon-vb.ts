import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const offs = await prisma.offering.findMany({ where: { name: { contains: "Volleyball", mode: "insensitive" } }, select: { id: true, name: true, status: true, startDate: true, endDate: true, programId: true } });
  console.log(JSON.stringify(offs, null, 1));
  const sessions = await prisma.session.findMany({
    where: { offeringId: { in: offs.map(o => o.id) }, status: "scheduled", startTime: { gte: new Date("2026-10-26T00:00:00Z") } },
    include: { coaches: { include: { staff: { select: { firstName: true, lastName: true } } } }, _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } }, series: true },
    orderBy: { startTime: "asc" },
  });
  const mon = sessions.filter(s => s.startTime.getUTCDay() === 1);
  for (const s of mon.slice(0, 12)) console.log(s.startTime.toISOString(), offs.find(o=>o.id===s.offeringId)?.name, "cap", s.capacity, "booked", s._count.bookings, "res", s.resourceId, "coach", s.coaches.map(c=>c.staff.firstName).join(","), "series", s.seriesId);
  console.log("monday total", mon.length, "last", mon.at(-1)?.startTime.toISOString());
}
main().finally(() => prisma.$disconnect());
