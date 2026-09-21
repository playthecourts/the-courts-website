// Emergency Medical Authorization: reworded so the waiver ends on the
// "reasonable efforts to contact me" sentence. Past signatures keep the
// exact text they accepted (WaiverSignature.acceptedContent snapshot).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const content = [
  "I authorize The Courts to provide reasonable first aid to my athlete(s) when appropriate.",
  "If one of my athletes becomes seriously ill or injured and I cannot be reached promptly, I authorize The Courts to contact emergency medical services and provide relevant emergency information to responding medical professionals.",
  "I authorize licensed medical professionals to evaluate and provide emergency treatment when, in their professional judgment, treatment is necessary and delaying care could place my athlete at risk.",
  "I understand that I am responsible for medical costs incurred on behalf of my athlete(s) that are not otherwise covered.",
  "I understand that The Courts will make reasonable efforts to contact me or another emergency contact as quickly as possible in the event of an emergency.",
].join("\n\n");
async function main() {
  const r = await prisma.waiver.update({ where: { id: "f1885ca4-4403-4c9a-85a1-ed45b2151660" }, data: { content, version: "1.1" } });
  console.log(r.version, "\n" + r.content);
}
main().finally(() => prisma.$disconnect());
