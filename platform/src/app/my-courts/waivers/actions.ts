"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/app/my-courts/athletes/actions";

const OK: ActionState = { ok: true };

async function getIpAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ??
    requestHeaders.get("x-real-ip") ??
    null
  );
}

// Missing/short name and (for the family form) no athlete selected are
// regular form-validation outcomes a guardian can easily hit — e.g. nothing
// stops submitting with zero checkboxes checked, since "no box pre-checked"
// is deliberate here. Those return {ok:false, errors} so the form can show
// an inline message. Auth failures stay thrown: a guardian should never
// legitimately reach those paths, so surfacing them as a hard error (and
// logging them) is correct, not a UX gap to smooth over.
function typedNameError(formData: FormData): string | null {
  const typedName = (formData.get("typedName") as string)?.trim();
  if (!typedName || typedName.length < 2) return "Type your full legal name to sign.";
  return null;
}

/// Athlete-scope waivers stay one signature = one named athlete, unchanged
/// from before — no coverage ambiguity to solve here.
export async function signAthleteWaiver(
  waiverId: string,
  athleteId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guardian = await getCurrentGuardian();
  const ownsAthlete = guardian.families.some((fg) => fg.family.athletes.some((a) => a.id === athleteId));
  if (!ownsAthlete) throw new Error("Not authorized to sign for this athlete.");

  const nameError = typedNameError(formData);
  if (nameError) return { ok: false, errors: { typedName: nameError } };
  const typedName = (formData.get("typedName") as string).trim();

  const existing = await prisma.waiverSignature.findFirst({
    where: { waiverId, guardianId: guardian.id, athleteId },
  });
  if (existing) return OK; // already signed — no-op, not an error

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
  return OK;
}

/// Family-scope waivers: one signing EVENT explicitly covers exactly the
/// athletes the guardian selected — never "everyone, including athletes
/// added later." A new signature row is always inserted (never merged into
/// or overwriting a prior one), so covering a newly added athlete later is
/// just a new, smaller signing event, and the full history stays intact.
export async function signFamilyWaiver(
  waiverId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guardian = await getCurrentGuardian();
  const athleteIds = formData.getAll("athleteId").map(String);

  const ownedAthleteIds = new Set(
    guardian.families.flatMap((fg) => fg.family.athletes.map((a) => a.id))
  );
  if (athleteIds.length === 0) {
    return { ok: false, errors: { athleteId: "Choose at least one athlete this signature covers." } };
  }
  if (athleteIds.some((id) => !ownedAthleteIds.has(id))) {
    throw new Error("Not authorized to sign for one of the selected athletes.");
  }

  const nameError = typedNameError(formData);
  if (nameError) return { ok: false, errors: { typedName: nameError } };
  const typedName = (formData.get("typedName") as string).trim();

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
  return OK;
}
