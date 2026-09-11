"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentGuardian } from "@/lib/dal";
import {
  requireGuardianAthlete,
  primaryFamilyIdFor,
  recordProfileChange,
  recordIfChanged,
  type ProfileChangeActor,
} from "@/lib/athlete-profile";
import { uploadAthletePhoto, deleteAthletePhoto } from "@/lib/athlete-photo";
import { RELEASE_VERSION } from "@/lib/media-consent";
import type { MediaConsentStatus, CompetitiveMeter } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Parent-side writes for the athlete profile.
//
// Every action re-resolves the athlete through requireGuardianAthlete(), which
// scopes the lookup to the signed-in guardian's families. Server actions are
// their own endpoints — reachable without ever rendering the form that hides
// the button — so this is the actual gate, not a second opinion.
//
// Actions return a small { ok, errors } shape rather than throwing on bad
// input, because a parent typing a name wrong is a normal event, not a fault.
// ---------------------------------------------------------------------------

export type ActionState = {
  ok: boolean;
  errors?: Record<string, string>;
  athleteId?: string;
  message?: string;
};

const OK: ActionState = { ok: true };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v.length > 0 ? v : null;
}

function many(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((v) => String(v)).filter((v) => v.length > 0);
}

async function actorFor(): Promise<ProfileChangeActor & { id: string }> {
  const guardian = await getCurrentGuardian();
  return { type: "guardian", id: guardian.id, label: guardian.name };
}

function revalidateAthlete(athleteId: string) {
  revalidatePath(`/my-courts/athletes/${athleteId}`);
  revalidatePath("/my-courts/athletes");
  revalidatePath("/my-courts");
}

// ---------------------------------------------------------------------------
// Step 1 — who are we adding
// ---------------------------------------------------------------------------

export async function createAthlete(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const guardian = await getCurrentGuardian();

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const nickname = optional(formData, "nickname");
  const dobRaw = str(formData, "dob");
  const grade = str(formData, "grade");
  const school = optional(formData, "school");
  const sports = many(formData, "sports");
  const favoriteSport = optional(formData, "favoriteSport");

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "We need a first name.";
  if (!lastName) errors.lastName = "We need a last name.";
  if (!grade) errors.grade = "Pick their current grade.";
  if (sports.length === 0) errors.sports = "Pick at least one sport.";

  // Date-only, parsed as UTC so the stored day can't shift and change the
  // birthday month we show back to them.
  let dob: Date | null = null;
  if (!dobRaw) {
    errors.dob = "We need their date of birth.";
  } else {
    const parsed = new Date(`${dobRaw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      errors.dob = "That date doesn't look right.";
    } else if (parsed > new Date()) {
      errors.dob = "That date is in the future.";
    } else if (parsed < new Date("1990-01-01T00:00:00.000Z")) {
      errors.dob = "That date doesn't look right.";
    } else {
      dob = parsed;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const familyId = await primaryFamilyIdFor(guardian.id);

  const athlete = await prisma.athlete.create({
    data: {
      familyId,
      firstName,
      lastName,
      nickname,
      dob: dob!,
      grade,
      school,
      sports,
      // Only meaningful when they play both, and only if they said.
      favoriteSport: sports.length > 1 ? favoriteSport : null,
      basicsCompletedAt: new Date(),
      profileStep: "photo",
    },
  });

  const actor = await actorFor();
  await recordProfileChange({
    athleteId: athlete.id,
    actor,
    category: "profile",
    field: "athlete_created",
    newValue: `${firstName} ${lastName}`,
  });

  revalidateAthlete(athlete.id);
  return { ok: true, athleteId: athlete.id };
}

// ---------------------------------------------------------------------------
// Photo
//
// Optional, always. The image arrives already cropped and downscaled by the
// browser (photo-picker.tsx); the checks in uploadAthletePhoto re-verify type
// and size on the server anyway.
// ---------------------------------------------------------------------------

export async function saveAthletePhoto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete } = await requireGuardianAthlete(athleteId);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { photo: "Pick a photo first." } };
  }

  const result = await uploadAthletePhoto(athlete.id, file);
  if (!result.ok) return { ok: false, errors: { photo: result.error } };

  const previousPath = athlete.photoPath;
  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { photoPath: result.path, photoUpdatedAt: new Date() },
  });

  // The old object is removed only after the new path is committed, so a
  // failure here leaves a stray file rather than a profile pointing at nothing.
  if (previousPath) await deleteAthletePhoto(previousPath);

  const actor = await actorFor();
  await recordProfileChange({
    athleteId: athlete.id,
    actor,
    category: "profile",
    field: "photo",
    oldValue: previousPath ? "photo on file" : "no photo",
    newValue: "photo on file",
  });

  revalidateAthlete(athlete.id);
  return OK;
}

export async function removeAthletePhoto(athleteId: string) {
  const { athlete } = await requireGuardianAthlete(athleteId);
  if (!athlete.photoPath) return;

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: { photoPath: null, photoUpdatedAt: new Date() },
  });
  await deleteAthletePhoto(athlete.photoPath);

  const actor = await actorFor();
  await recordProfileChange({
    athleteId: athlete.id,
    actor,
    category: "profile",
    field: "photo",
    oldValue: "photo on file",
    newValue: "no photo",
  });
  revalidateAthlete(athlete.id);
}

// ---------------------------------------------------------------------------
// Step 2 — a little about them
// ---------------------------------------------------------------------------

export async function saveAbout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete } = await requireGuardianAthlete(athleteId);

  const goal = optional(formData, "goal");
  const coachingPreferences = many(formData, "coachingPreferences");
  const competitiveMeterRaw = optional(formData, "competitiveMeter");
  const otherSports = many(formData, "otherSports");
  const otherSportsFreeText = optional(formData, "otherSportsOther");
  const parentCoachNote = optional(formData, "parentCoachNote");

  const allowedMeters: CompetitiveMeter[] = ["here_to_learn", "likes_a_challenge", "keep_score"];
  const competitiveMeter =
    competitiveMeterRaw && allowedMeters.includes(competitiveMeterRaw as CompetitiveMeter)
      ? (competitiveMeterRaw as CompetitiveMeter)
      : null;

  const sports = otherSportsFreeText
    ? [...otherSports, otherSportsFreeText]
    : otherSports;

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      goal,
      coachingPreferences,
      competitiveMeter,
      otherSports: sports,
      parentCoachNote,
      profileStep: "safety",
    },
  });

  const actor = await actorFor();
  await recordIfChanged({
    athleteId: athlete.id,
    actor,
    category: "profile",
    field: "goal",
    before: athlete.goal,
    after: goal,
  });
  await recordIfChanged({
    athleteId: athlete.id,
    actor,
    category: "profile",
    field: "parent_coach_note",
    before: athlete.parentCoachNote,
    after: parentCoachNote,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

// ---------------------------------------------------------------------------
// Step 3 — safety + family
// ---------------------------------------------------------------------------

export async function saveSafety(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  const hasMedicalInfo = str(formData, "hasMedicalInfo") === "yes";
  const medicalNotes = hasMedicalInfo ? optional(formData, "medicalNotes") : null;

  const contactName = str(formData, "emergencyName");
  const contactRelationship = str(formData, "emergencyRelationship");
  const contactPhone = str(formData, "emergencyPhone");
  const sameAsGuardian = str(formData, "sameAsGuardian") === "yes";
  const sameAsGuardianId = optional(formData, "sameAsGuardianId");

  const errors: Record<string, string> = {};
  if (hasMedicalInfo && !medicalNotes) {
    errors.medicalNotes = "Tell us what our staff should know.";
  }
  // The emergency contact is the one thing here we hold out for — everything
  // else on this screen can be finished later.
  if (!contactName) errors.emergencyName = "We need a name.";
  if (!contactRelationship) errors.emergencyRelationship = "How are they related?";
  if (!contactPhone) errors.emergencyPhone = "We need a phone number.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const actor: ProfileChangeActor = { type: "guardian", id: guardianId, label: guardianName };

  await prisma.$transaction(async (tx) => {
    await tx.athlete.update({
      where: { id: athlete.id },
      data: { hasMedicalInfo, medicalNotes, profileStep: "privacy" },
    });

    // One primary emergency contact is replaced in place rather than appended,
    // so a parent correcting a phone number doesn't leave a stale second row
    // for the front desk to guess between.
    const existing = athlete.emergencyContacts[0];
    if (existing) {
      await tx.emergencyContact.update({
        where: { id: existing.id },
        data: {
          name: contactName,
          relationship: contactRelationship,
          phone: contactPhone,
          guardianId: sameAsGuardian ? sameAsGuardianId : null,
        },
      });
    } else {
      await tx.emergencyContact.create({
        data: {
          athleteId: athlete.id,
          name: contactName,
          relationship: contactRelationship,
          phone: contactPhone,
          guardianId: sameAsGuardian ? sameAsGuardianId : null,
          sortOrder: 0,
        },
      });
    }
  });

  await recordIfChanged({
    athleteId: athlete.id,
    actor,
    category: "medical",
    field: "medical_information",
    before: athlete.medicalNotes,
    after: medicalNotes,
  });
  await recordProfileChange({
    athleteId: athlete.id,
    actor,
    category: "emergency",
    field: "emergency_contact",
    oldValue: athlete.emergencyContacts[0]?.name ?? null,
    newValue: contactName,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

export async function saveCustody(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  const hasCustodyRestrictions = str(formData, "hasCustodyRestrictions") === "yes";
  const custodyRestrictions = hasCustodyRestrictions
    ? optional(formData, "custodyRestrictions")
    : null;

  if (hasCustodyRestrictions && !custodyRestrictions) {
    return { ok: false, errors: { custodyRestrictions: "Tell us what our staff needs to know." } };
  }

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      hasCustodyRestrictions,
      custodyRestrictions,
      // Clearing the restriction clears the coach-facing instruction with it —
      // an instruction that outlives its reason is worse than none.
      custodyStaffInstruction: hasCustodyRestrictions ? athlete.custodyStaffInstruction : null,
    },
  });

  await recordIfChanged({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "custody",
    field: "custody_restrictions",
    before: athlete.custodyRestrictions,
    after: custodyRestrictions,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

// ---------------------------------------------------------------------------
// Guardians + pickup
// ---------------------------------------------------------------------------

export async function addGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const relationship = str(formData, "relationship");
  const email = optional(formData, "email");
  const phone = optional(formData, "phone");
  const isPrimary = str(formData, "isPrimary") === "yes";
  const authorizedForPickup = str(formData, "authorizedForPickup") !== "no";
  const livesWithAthleteRaw = str(formData, "livesWithAthlete");

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "We need a first name.";
  if (!lastName) errors.lastName = "We need a last name.";
  if (!relationship) errors.relationship = "How are they related?";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const name = `${firstName} ${lastName}`;

  // A guardian with an email we already know is the SAME person — they get
  // linked to this family, never duplicated into a second record.
  const existing = email
    ? await prisma.guardian.findUnique({ where: { email } })
    : null;

  await prisma.$transaction(async (tx) => {
    const guardian =
      existing ??
      (await tx.guardian.create({
        // No authId: this person has no login yet. They are still a real
        // guardian on the record, and if they sign up later this row is the one
        // that gets an authId — a second guardian is never created for them.
        data: { name, email, phone },
      }));

    await tx.familyGuardian.upsert({
      where: { familyId_guardianId: { familyId: athlete.familyId, guardianId: guardian.id } },
      create: {
        familyId: athlete.familyId,
        guardianId: guardian.id,
        isPrimary,
        relationship,
        authorizedForPickup,
        livesWithAthlete: livesWithAthleteRaw ? livesWithAthleteRaw === "yes" : null,
      },
      update: {
        isPrimary,
        relationship,
        authorizedForPickup,
        livesWithAthlete: livesWithAthleteRaw ? livesWithAthleteRaw === "yes" : null,
      },
    });
  });

  await recordProfileChange({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "guardians",
    field: "guardian_added",
    newValue: `${name} (${relationship})`,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

export async function updateGuardianPickup(
  athleteId: string,
  targetGuardianId: string,
  authorized: boolean
) {
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  await prisma.familyGuardian.update({
    where: { familyId_guardianId: { familyId: athlete.familyId, guardianId: targetGuardianId } },
    data: { authorizedForPickup: authorized },
  });

  await recordProfileChange({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "pickup",
    field: "guardian_pickup_authorization",
    oldValue: authorized ? "not authorized" : "authorized",
    newValue: authorized ? "authorized" : "not authorized",
  });

  revalidateAthlete(athlete.id);
}

export async function addPickupPerson(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  const name = str(formData, "name");
  const relationship = str(formData, "relationship");
  const phone = str(formData, "phone");
  const note = optional(formData, "note");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "We need a name.";
  if (!relationship) errors.relationship = "How are they related?";
  if (!phone) errors.phone = "We need a phone number.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  await prisma.authorizedPickup.create({
    data: { athleteId: athlete.id, name, relationship, phone, note },
  });

  await recordProfileChange({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "pickup",
    field: "pickup_person_added",
    newValue: `${name} (${relationship})`,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

export async function removePickupPerson(athleteId: string, pickupId: string) {
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  // Scoped by athleteId as well as id — a pickup id from another family cannot
  // be deleted by guessing it.
  const removed = await prisma.authorizedPickup.updateMany({
    where: { id: pickupId, athleteId: athlete.id },
    data: { active: false },
  });
  if (removed.count === 0) return;

  await recordProfileChange({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "pickup",
    field: "pickup_person_removed",
    oldValue: pickupId,
  });

  revalidateAthlete(athlete.id);
}

// ---------------------------------------------------------------------------
// Step 4 — photos + video
//
// Separate from the waiver, separate from the profile photo, and never
// preselected: the parent has to make an affirmative choice. Saying no does not
// restrict participation anywhere in this codebase.
// ---------------------------------------------------------------------------

export async function saveMediaConsent(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const athleteId = str(formData, "athleteId");
  const { athlete, guardianId, guardianName } = await requireGuardianAthlete(athleteId);

  const statusRaw = str(formData, "status");

  // Only two choices are offered on the consent screen itself — clicking
  // "Yes" or "No" is the explicit affirmative act, so there is no separate
  // acknowledgment checkbox to also require. media_limited remains a valid
  // stored value (staff tooling and historical records still handle it) but
  // is no longer one of the choices a parent is offered here.
  const allowed: MediaConsentStatus[] = ["media_ok", "media_no"];
  const errors: Record<string, string> = {};
  if (!allowed.includes(statusRaw as MediaConsentStatus)) {
    errors.status = "Choose yes or no.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const status = statusRaw as MediaConsentStatus;
  const previous = athlete.mediaConsent?.status ?? null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.mediaConsent.upsert({
      where: { athleteId: athlete.id },
      create: {
        athleteId: athlete.id,
        status,
        consentedByGuardianId: guardianId,
        guardianName,
        guardianRelationship: "Parent/Guardian",
        acknowledged: true,
        consentDate: now,
        releaseVersion: RELEASE_VERSION,
      },
      update: {
        status,
        consentedByGuardianId: guardianId,
        guardianName,
        guardianRelationship: "Parent/Guardian",
        acknowledged: true,
        consentDate: now,
        releaseVersion: RELEASE_VERSION,
      },
    });

    if (previous !== status) {
      await tx.mediaConsentChange.create({
        data: {
          athleteId: athlete.id,
          oldStatus: previous,
          newStatus: status,
          changedByGuardianId: guardianId,
          releaseVersion: RELEASE_VERSION,
          // Narrowing permission after a yes is the case where something may
          // already be published. That needs a human to look, so it is flagged
          // for admin follow-up rather than quietly saved.
          needsFollowUp: previous === "media_ok" && status !== "media_ok",
        },
      });
    }

    // Legacy boolean kept in sync for any older read path. MediaConsent is the
    // source of truth; this is never read to make a publishing decision.
    // profileStep is untouched here — media consent lives outside the profile
    // setup flow now, so answering it must not disturb setup progress.
    await tx.athlete.update({
      where: { id: athlete.id },
      data: { photoConsent: status === "media_ok" },
    });
  });

  await recordProfileChange({
    athleteId: athlete.id,
    actor: { type: "guardian", id: guardianId, label: guardianName },
    category: "media_consent",
    field: "media_consent_status",
    oldValue: previous,
    newValue: status,
  });

  revalidateAthlete(athlete.id);
  return OK;
}

/// "Finish Later" — records where they stopped and sends them to the profile.
/// Nothing is lost and nothing is blocked; the profile just shows a quiet nudge.
export async function finishLater(athleteId: string, step: string) {
  const { athlete } = await requireGuardianAthlete(athleteId);
  await prisma.athlete.update({ where: { id: athlete.id }, data: { profileStep: step } });
  revalidateAthlete(athlete.id);
  redirect(`/my-courts/athletes/${athlete.id}`);
}
