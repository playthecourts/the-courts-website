"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, canManageStaffing } from "@/lib/coach-dal";

// The write half of the coverage flow. requestCoverage() (creating a
// request) already existed in coach/(app)/sessions/actions.ts — this is the
// other two real actions the existing UI and Today-dashboard links assumed
// existed: withdrawing your own open request, and leadership assigning a
// replacement.

/// A coach withdraws their own still-open request — e.g. they found their
/// own cover, or the plan changed. Only the requester (or an admin) may do
/// this; a plain coach can't cancel someone else's.
export async function cancelCoverageRequest(requestId: string) {
  const actor = await getCurrentCoach();
  const request = await prisma.coverageRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.requestedById !== actor.id && !actor.isAdmin) {
    throw new Error("Not authorized to cancel this request.");
  }
  if (request.status !== "open") return;

  await prisma.coverageRequest.update({
    where: { id: requestId },
    data: { status: "cancelled", resolvedAt: new Date() },
  });
  revalidatePath("/coach/coverage");
}

/// Leadership (admin or the head coach for that sport) assigns a substitute.
/// The original requester is covered, not double-booked — their SessionCoach
/// row for this specific session is removed and the substitute's is added
/// (role "substitute"), so the roster/schedule reflects who's actually
/// showing up. Every other SessionCoach row this coach might have elsewhere
/// is untouched.
export async function assignCoverage(requestId: string, staffUserId: string) {
  const actor = await getCurrentCoach();
  const request = await prisma.coverageRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { session: { include: { program: true } } },
  });
  if (!canManageStaffing(actor, request.session.program.sport)) {
    throw new Error("Not authorized to assign coverage for this sport.");
  }
  if (request.status !== "open") return;

  await prisma.$transaction([
    prisma.sessionCoach.deleteMany({ where: { sessionId: request.sessionId, staffUserId: request.requestedById } }),
    prisma.sessionCoach.upsert({
      where: { sessionId_staffUserId: { sessionId: request.sessionId, staffUserId } },
      create: { sessionId: request.sessionId, staffUserId, role: "substitute" },
      update: { role: "substitute" },
    }),
    prisma.coverageRequest.update({
      where: { id: requestId },
      data: { status: "assigned", assignedToId: staffUserId, resolvedAt: new Date() },
    }),
  ]);

  revalidatePath("/coach/coverage");
  revalidatePath(`/coach/sessions/${request.sessionId}`);
}
