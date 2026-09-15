"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

async function getIpAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ??
    requestHeaders.get("x-real-ip") ??
    null
  );
}

function requireTypedName(formData: FormData) {
  const typedName = (formData.get("typedName") as string)?.trim();
  if (!typedName || typedName.length < 2) {
    throw new Error("Type your full legal name to sign.");
  }
  return typedName;
}

/// Athlete-scope waivers stay one signature = one named athlete, unchanged
/// from before — no coverage ambiguity to solve here.
export async function signAthleteWaiver(waiverId: string, athleteId: string, formData: FormData) {
  const guardian = await getCurrentGuardian();
  const ownsAthlete = guardian.families.some((fg) => fg.family.athletes.some((a) => a.id === athleteId));
  if (!ownsAthlete) throw new Error("Not authorized to sign for this athlete.");

  const typedName = requireTypedName(formData);

  const existing = await prisma.waiverSignature.findFirst({
    where: { waiverId, guardianId: guardian.id, athleteId },
  });
  if (existing) return; // already signed — no-op, not an error

  const waiver = await prisma.waiver.findUniqueOrThrow({ where: { id: waiverId } });
  const ipAddress = await getIpAddress();

  await prisma.waiverSignature.create({
    data: {
      waiverId,
      guardianId: guardian.id,
      athleteId,
      signedName: typedName,
      ipAddress,
      acceptedVersion: waiver.version,
      acceptedContent: waiver.content,
    },
  });
  revalidatePath("/my-courts/waivers");
  revalidatePath(`/my-courts/athletes/${athleteId}`);
}

/// Family-scope waivers: one signing EVENT explicitly covers exactly the
/// athletes the guardian selected — never "everyone, including athletes
/// added later." A new signature row is always inserted (never merged into
/// or overwriting a prior one), so covering a newly added athlete later is
/// just a new, smaller signing event, and the full history stays intact.
export async function signFamilyWaiver(waiverId: string, formData: FormData) {
  const guardian = await getCurrentGuardian();
  const athleteIds = formData.getAll("athleteId").map(String);

  const ownedAthleteIds = new Set(
    guardian.families.flatMap((fg) => fg.family.athletes.map((a) => a.id))
  );
  if (athleteIds.length === 0) {
    throw new Error("Choose at least one athlete this signature covers.");
  }
  if (athleteIds.some((id) => !ownedAthleteIds.has(id))) {
    throw new Error("Not authorized to sign for one of the selected athletes.");
  }

  const typedName = requireTypedName(formData);
  const waiver = await prisma.waiver.findUniqueOrThrow({ where: { id: waiverId } });
  const ipAddress = await getIpAddress();

  await prisma.waiverSignature.create({
    data: {
      waiverId,
      guardianId: guardian.id,
      athleteId: null,
      signedName: typedName,
      ipAddress,
      acceptedVersion: waiver.version,
      acceptedContent: waiver.content,
      coveredAthletes: { createMany: { data: athleteIds.map((athleteId) => ({ athleteId })) } },
    },
  });
  revalidatePath("/my-courts/waivers");
  for (const athleteId of athleteIds) {
    revalidatePath(`/my-courts/athletes/${athleteId}`);
  }
}
