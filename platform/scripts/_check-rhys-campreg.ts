import "dotenv/config";
import Module from "module";
const orig = (Module as any)._load;
(Module as any)._load = function (request: string, ...args: any[]) {
  if (request === "server-only") return {};
  return orig.call(this, request, ...args);
};
async function main() {
  const { prisma } = await eval("require")("../src/lib/prisma");
  const athlete = await prisma.athlete.findFirst({ where: { firstName: "Rhys" }, include: { family: true } });
  console.log("athlete:", athlete?.id, athlete?.firstName, athlete?.lastName);
  const offerings = await prisma.offering.findMany({ where: { name: { contains: "Fall Break", mode: "insensitive" } } });
  console.log("offerings:", offerings.map((o: any) => ({ id: o.id, name: o.name })));
  if (athlete) {
    const regs = await prisma.registration.findMany({ where: { athleteId: athlete.id }, include: { offering: true } });
    console.log("registrations:", regs.map((r: any) => ({ id: r.id, offering: r.offering.name, status: r.status, paymentStatus: r.paymentStatus, cancelledAt: r.cancelledAt })));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
