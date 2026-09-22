import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
(async()=>{
 const gs = await p.guardian.findMany({ where: { OR: [{ name: { contains: "Smith", mode: "insensitive" } }, { email: { contains: "smith", mode: "insensitive" } }] } });
 console.log(JSON.stringify(gs, null, 1));
 const recs = await p.nextGenRecord.findMany({ where: { OR: [{ name: { contains: "Smith", mode: "insensitive" } }, { email: { contains: "smith", mode: "insensitive" } }, { matchedGuardianId: { in: gs.map(g=>g.id) } }] } });
 console.log(JSON.stringify(recs, null, 1));
 const logs = await p.auditLog.findMany({ where: { entityId: { in: gs.map(g=>g.id) }, action: { in: ["verify_nextgen_founder"] } }, orderBy: { createdAt: "desc" } });
 console.log(JSON.stringify(logs, null, 1));
})().finally(()=>p.$disconnect());
