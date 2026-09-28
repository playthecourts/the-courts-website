"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach } from "@/lib/coach-dal";

/// Claiming an open shift — Melissa's own words: "leave it as an open
/// shift" (a session with zero coaches is the thing a coach can pick up).
/// Re-checks inside the transaction that it's still actually open, since
/// two coaches could both be looking at the same shift at once.
export async function claimOpenShift(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const actor = await getCurrentCoach();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.sessionCoach.findFirst({ where: { sessionId } });
    if (existing) return { ok: false as const, error: "Someone already took this one." };

    await tx.sessionCoach.create({ data: { sessionId, staffUserId: actor.id, role: "lead" } });
    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath("/coach/open-shifts");
    revalidatePath("/coach/schedule");
    revalidatePath(`/coach/sessions/${sessionId}`);
  }
  return result;
}
