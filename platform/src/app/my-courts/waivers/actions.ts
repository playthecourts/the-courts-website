"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function signWaiver(waiverId: string, athleteId: string | null, formData: FormData) {
  const guardian = await getCurrentGuardian();

  if (athleteId) {
    const ownsAthlete = guardian.families.some((fg) =>
      fg.family.athletes.some((a) => a.id === athleteId)
    );
    if (!ownsAthlete) throw new Error("Not authorized to sign for this athlete.");
  }

  const typedName = (formData.get("typedName") as string).trim();
  if (!typedName || typedName.length < 2) {
    throw new Error("Type your full legal name to sign.");
  }

  const requestHeaders = await headers();
  const ipAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ??
    requestHeaders.get("x-real-ip") ??
    null;

  const existing = await prisma.waiverSignature.findFirst({
    where: { waiverId, guardianId: guardian.id, athleteId },
  });
  if (existing) return; // already signed — no-op, not an error

  await prisma.waiverSignature.create({
    data: { waiverId, guardianId: guardian.id, athleteId, signedName: typedName, ipAddress },
  });
  revalidatePath("/my-courts/waivers");
}
