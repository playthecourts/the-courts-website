"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, OsAccessError } from "@/lib/os/dal";
import { canForSport } from "@/lib/os/permissions";
import { sendStaffMessage, markThreadReadByStaff } from "@/lib/messaging";

// Staff replying to a family. Capability is re-checked here because an action
// is its own endpoint — reachable without ever rendering the page that shows
// the reply box.

async function assertThreadAccess(threadId: string) {
  const actor = await requireCapability("communications.send");
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { id: true, offering: { select: { program: { select: { sport: true } } } } },
  });
  if (!thread) throw new OsAccessError("That conversation isn't available.");

  // A head coach may only answer threads inside their sport. A thread with no
  // program attached is general Courts business and stays with admin.
  const sport = thread.offering?.program.sport ?? null;
  if (!canForSport(actor, "communications.send", sport)) {
    throw new OsAccessError("That conversation is outside your sport.");
  }
  return actor;
}

export async function replyAsStaff(threadId: string, formData: FormData) {
  const actor = await assertThreadAccess(threadId);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a reply first." };

  await sendStaffMessage({
    staffUserId: actor.id,
    threadId,
    body,
    resolve: formData.get("resolve") === "on",
  });

  revalidatePath(`/os/communications/${threadId}`);
  revalidatePath("/os/communications");
  return { ok: true as const };
}

export async function markRead(threadId: string) {
  await assertThreadAccess(threadId);
  await markThreadReadByStaff(threadId);
  revalidatePath("/os/communications");
}

export async function reopenThread(threadId: string) {
  await assertThreadAccess(threadId);
  await prisma.messageThread.update({ where: { id: threadId }, data: { status: "open" } });
  revalidatePath(`/os/communications/${threadId}`);
  revalidatePath("/os/communications");
}
