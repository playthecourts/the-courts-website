import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
(async()=>{
 const o = await p.offering.findFirstOrThrow({ where: { name: "Fall 2026 Basketball League" } });
 const teams = await p.team.findMany({ include: { members: true, sessions: true } });
 console.log(JSON.stringify(teams.map(t=>({id:t.id,name:t.name,division:t.division,offeringId:t.offeringId,members:t.members.length,sessions:t.sessions.length})),null,1));
})().finally(()=>p.$disconnect());
