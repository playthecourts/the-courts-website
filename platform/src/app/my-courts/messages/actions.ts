"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { sendFamilyMessage, markThreadReadByFamily } from "@/lib/messaging";

// A guardian may only ever act on their own families. That is established here
// from the session, never from a form field — a familyId in a payload is an
// input, not a permission.

async function guardianFamilies() {
  const guardian = await getCurrentGuardian();
  return {
    guardian,
    familyIds: guardian.families.map((fg) => fg.family.id),
  };
}

export async function startThread(_prev: unknown, formData: FormData) {
  const { guardian, familyIds } = await guardianFamilies();
  const body = String(formData.get("body") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!body) return { error: "Write your message first." };
  if (!subject) return { error: "Add a subject so we can route it to the right person." };

  const athleteId = String(formData.get("athleteId") ?? "") || null;
  // Confirm the athlete belongs to this guardian before attaching them.
  const validAthlete = athleteId
    ? guardian.families.some((fg) => fg.family.athletes.some((a) => a.id === athleteId))
    : false;

  const { threadId } = await sendFamilyMessage({
    guardianId: guardian.id,
    familyId: familyIds[0],
    subject,
    body,
    context: { athleteId: validAthlete ? athleteId : null },
    notifyByEmail: formData.get("notifyByEmail") === "on",
  });

  revalidatePath("/my-courts/messages");
  redirect(`/my-courts/messages/${threadId}`);
}

export async function replyToThread(threadId: string, formData: FormData) {
  const { guardian, familyIds } = await guardianFamilies();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write your reply first." };

  await sendFamilyMessage({
    guardianId: guardian.id,
    familyId: familyIds[0],
    threadId,
    body,
  });

  revalidatePath(`/my-courts/messages/${threadId}`);
  revalidatePath("/my-courts/messages");
}

export async function markRead(threadId: string) {
  const { familyIds } = await guardianFamilies();
  await markThreadReadByFamily(threadId, familyIds);
  revalidatePath("/my-courts/messages");
}

export async function markBroadcastRead(communicationId: string) {
  const { guardian } = await guardianFamilies();
  await prisma.communicationRecipient.updateMany({
    where: { communicationId, guardianId: guardian.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/my-courts/messages");
}
