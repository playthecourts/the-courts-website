import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, p: unknown, m: boolean) {
  if (r === "server-only") return {};
  return _load.call(this, r, p, m);
};
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (n: string, p: boolean, d: string) => {
  results.push({ name: n, pass: p, detail: d });
  console.log(`${p ? "PASS" : "FAIL"}  ${n}\n      ${d}`);
};

async function main() {
  const m = await import("../../src/lib/messaging");

  const link = await prisma.familyGuardian.findFirstOrThrow({ include: { guardian: true, family: true } });
  const { guardian, family } = link;
  const staff = await prisma.staffUser.findFirstOrThrow({ where: { active: true } });

  // A second family, to prove isolation.
  const otherFamily = await prisma.family.create({ data: { name: "[QA] Other Family" } });

  const { threadId } = await m.sendFamilyMessage({
    guardianId: guardian.id,
    familyId: family.id,
    subject: "[QA] Will Tuesday be made up?",
    body: "Hi — we saw Tuesday was cancelled. Is there a make-up?",
  });
  check("Parent can start a conversation", !!threadId, `thread ${threadId}`);

  const staffView = await prisma.messageThread.findUniqueOrThrow({
    where: { id: threadId },
    include: { messages: true },
  });
  check(
    "It reaches staff unread, attributed to the guardian",
    staffView.messages.length === 1 &&
      staffView.messages[0].authorGuardianId === guardian.id &&
      staffView.messages[0].authorStaffId === null &&
      staffView.messages[0].readByStaffAt === null,
    `1 message, from guardian, unread by staff`
  );

  await m.sendStaffMessage({ staffUserId: staff.id, threadId, body: "Yes — Oct 20.", resolve: true });
  const afterReply = await prisma.messageThread.findUniqueOrThrow({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  check(
    "Staff reply lands, is attributed, and can close the thread",
    afterReply.messages.length === 2 &&
      afterReply.messages[1].authorStaffId === staff.id &&
      afterReply.messages[1].authorGuardianId === null &&
      afterReply.status === "resolved",
    `2 messages; status=${afterReply.status}`
  );

  const unread = await m.unreadCountForFamily(guardian.id, [family.id]);
  check("The family sees an unread reply", unread >= 1, `unread=${unread}`);

  // Isolation: another family's ids must not open this thread.
  const leaked = await m.threadForFamily(threadId, [otherFamily.id]);
  check(
    "A different family cannot open the thread",
    leaked === null,
    `threadForFamily with another family's id returned ${leaked === null ? "null" : "A THREAD"}`
  );

  // A reply from the family reopens a resolved thread.
  await m.sendFamilyMessage({ guardianId: guardian.id, familyId: family.id, threadId, body: "Thanks!" });
  const reopened = await prisma.messageThread.findUniqueOrThrow({ where: { id: threadId } });
  check(
    "A family reply reopens an answered thread",
    reopened.status === "open",
    `status=${reopened.status} — it doesn't vanish into 'answered'`
  );

  // Exactly one author per message, always.
  const all = await prisma.message.findMany({ where: { threadId } });
  const ambiguous = all.filter((x) => (!!x.authorGuardianId) === (!!x.authorStaffId));
  check(
    "Every message has exactly one author",
    ambiguous.length === 0,
    `${all.length} messages, ${ambiguous.length} ambiguous`
  );

  await prisma.messageThread.delete({ where: { id: threadId } });
  await prisma.family.delete({ where: { id: otherFamily.id } });

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} messaging scenarios passed`);
  if (passed !== results.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
