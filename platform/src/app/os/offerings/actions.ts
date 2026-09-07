"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, OsAccessError, assertOfferingAccess } from "@/lib/os/dal";
import { canForSport } from "@/lib/os/permissions";
import { auditLog } from "@/lib/audit";
import { syncOfferingToStripe } from "@/lib/programs/stripe-link";
import { checkReadiness } from "@/lib/programs/publish";
import { cloneOffering, captureTemplate } from "@/lib/programs/templates";
import { createSessions, moveSession, cancelSession, previewSchedule } from "@/lib/programs/scheduling";
import { offerNextSpot, waitlistSummary, expireStaleOffers } from "@/lib/programs/waitlist";
import type { ScheduleSpec, Weekday } from "@/lib/programs/recurrence";
import {
  bool, cents, dateOnly, int, lines, list, localDateTime, str, timeToMinutes,
} from "@/lib/programs/actions-shared";

// Every action re-checks capability. A server action is its own endpoint,
// reachable without ever rendering the page that hid the button.

async function loadForEdit(offeringId: string, capability: Parameters<typeof requireCapability>[0]) {
  const actor = await requireCapability(capability);
  const offering = await assertOfferingAccess(actor, offeringId);
  if (!canForSport(actor, capability, offering.program.sport)) {
    throw new OsAccessError("That program is outside your sport.");
  }
  return { actor, offering };
}

function touch(offeringId: string) {
  revalidatePath(`/os/offerings/${offeringId}`);
  revalidatePath("/os/programs");
  revalidatePath("/os/schedule");
}

/* ------------------------------------------------------------------ details */

export async function updateOfferingDetails(offeringId: string, formData: FormData) {
  const { actor } = await loadForEdit(offeringId, "programs.edit");

  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      name: str(formData, "name") ?? undefined,
      internalName: str(formData, "internalName"),
      seasonLabel: str(formData, "seasonLabel"),
      shortDescription: str(formData, "shortDescription"),
      fullDescription: str(formData, "fullDescription"),
      parentInstructions: str(formData, "parentInstructions"),
      coachNotes: str(formData, "coachNotes"),
      internalNotes: str(formData, "internalNotes"),
      whatToBring: lines(formData, "whatToBring"),
      websiteCta: str(formData, "websiteCta"),
      imageUrl: str(formData, "imageUrl"),
      imageAltText: str(formData, "imageAltText"),
      gradeMin: int(formData, "gradeMin"),
      gradeMax: int(formData, "gradeMax"),
      ageMin: int(formData, "ageMin"),
      ageMax: int(formData, "ageMax"),
      gender: str(formData, "gender"),
      skillLevel: (str(formData, "skillLevel") as never) ?? null,
      inviteOnly: bool(formData, "inviteOnly"),
      requiresTrainingPlan: bool(formData, "requiresTrainingPlan"),
      eligibilityNote: str(formData, "eligibilityNote"),
      capacityTotal: int(formData, "capacityTotal"),
      defaultSessionCapacity: int(formData, "defaultSessionCapacity"),
      lowSpotThreshold: int(formData, "lowSpotThreshold") ?? 3,
      waitlistMode: (str(formData, "waitlistMode") as never) ?? "automatic",
      waitlistOfferHours: int(formData, "waitlistOfferHours") ?? 24,
      registrationMode: (str(formData, "registrationMode") as never) ?? undefined,
      registrationOpensAt: localDateTime(formData, "registrationOpensAt"),
      registrationClosesAt: localDateTime(formData, "registrationClosesAt"),
      closeWhenFull: bool(formData, "closeWhenFull"),
      allowSingleDay: bool(formData, "allowSingleDay"),
      externalLocationName: str(formData, "externalLocationName"),
      externalLocationAddress: str(formData, "externalLocationAddress"),
      leagueStage: (str(formData, "leagueStage") as never) ?? null,
      startDate: dateOnly(formData, "startDate"),
      endDate: dateOnly(formData, "endDate"),
    },
  });

  await auditLog(actor.id, "publish_offering", "offering", offeringId, { field: "details" });
  touch(offeringId);
  return { ok: true as const };
}

/* ------------------------------------------------------------------- pricing */

export async function updateOfferingPricing(offeringId: string, formData: FormData) {
  // Pricing is its own capability. Marketing may edit copy and images; it may
  // not change what a family is charged.
  const { actor, offering } = await loadForEdit(offeringId, "programs.edit");

  const before = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    select: { priceCents: true, memberPriceCents: true },
  });

  const priceCents = cents(formData, "priceCents");
  const memberPriceCents = cents(formData, "memberPriceCents");

  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      pricingModel: (str(formData, "pricingModel") as never) ?? undefined,
      priceCents,
      memberPriceCents,
      singleDayPriceCents: cents(formData, "singleDayPriceCents"),
      depositCents: cents(formData, "depositCents"),
      creditRule: (str(formData, "creditRule") as never) ?? undefined,
      creditsPerBooking: int(formData, "creditsPerBooking") ?? 1,
      stripeTaxCode: str(formData, "stripeTaxCode"),
      taxBehavior: (str(formData, "taxBehavior") as never) ?? "unspecified",
    },
  });

  if (before.priceCents !== priceCents || before.memberPriceCents !== memberPriceCents) {
    await auditLog(actor.id, "change_price", "offering", offeringId, {
      previousPriceCents: before.priceCents,
      newPriceCents: priceCents,
      previousMemberPriceCents: before.memberPriceCents,
      newMemberPriceCents: memberPriceCents,
      offering: offering.id,
    });
  }

  touch(offeringId);
  return { ok: true as const };
}

export async function connectStripe(offeringId: string) {
  const { actor } = await loadForEdit(offeringId, "programs.publish");
  const result = await syncOfferingToStripe(offeringId);
  if (result.ok) {
    await auditLog(actor.id, "link_stripe", "offering", offeringId, {
      productId: result.productId,
      priceId: result.priceId,
    });
  }
  touch(offeringId);
  return result;
}

/* ---------------------------------------------------------------- visibility */

export async function updateVisibility(offeringId: string, formData: FormData) {
  const { actor } = await loadForEdit(offeringId, "programs.edit");
  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      visibleParentApp: bool(formData, "visibleParentApp"),
      visibleWebsite: bool(formData, "visibleWebsite"),
      visibleCoachApp: bool(formData, "visibleCoachApp"),
      internalOnly: bool(formData, "internalOnly"),
    },
  });
  await auditLog(actor.id, "publish_offering", "offering", offeringId, { field: "visibility" });
  touch(offeringId);
  return { ok: true as const };
}

/* ------------------------------------------------------------------ schedule */

function specFromForm(formData: FormData): ScheduleSpec {
  const kind = str(formData, "scheduleKind") ?? "one_time";
  const startMinute = timeToMinutes(str(formData, "startTime")) ?? 17 * 60;
  const durationMinutes = int(formData, "durationMinutes") ?? 60;
  const window = { startMinute, durationMinutes };

  switch (kind) {
    case "recurring": {
      const useCount = str(formData, "endMode") === "count";
      return {
        kind: "recurring",
        startDate: str(formData, "startDate") ?? "",
        ...(useCount
          ? { occurrenceCount: int(formData, "occurrenceCount") ?? 1 }
          : { endDate: str(formData, "endDate") ?? "" }),
        frequency: (str(formData, "frequency") as "weekly" | "biweekly") ?? "weekly",
        weekdays: list(formData, "weekdays").map((d) => Number(d) as Weekday),
        window,
      };
    }
    case "multi_day":
      return {
        kind: "multi_day",
        startDate: str(formData, "startDate") ?? "",
        endDate: str(formData, "endDate") ?? "",
        window,
        includeWeekends: bool(formData, "includeWeekends"),
      };
    case "custom":
      return {
        kind: "custom",
        dates: lines(formData, "customDates").map((date) => ({ date })),
        window,
      };
    default:
      return { kind: "one_time", date: str(formData, "startDate") ?? "", window };
  }
}

/// Powers the "you're about to create N sessions" preview. Creates nothing.
export async function previewOfferingSchedule(offeringId: string, formData: FormData) {
  await loadForEdit(offeringId, "schedule.edit");
  const spec = specFromForm(formData);
  const resourceIds = list(formData, "resourceIds");
  const coachIds = list(formData, "coachIds");

  const preview = await previewSchedule(offeringId, spec, resourceIds, coachIds);
  return {
    error: preview.error,
    occurrences: preview.occurrences.map((o) => ({
      start: o.startTime.toISOString(),
      end: o.endTime.toISOString(),
      index: o.index,
    })),
    conflicts: preview.conflicts.map((c) => ({
      severity: c.severity,
      type: c.type,
      message: c.message,
      at: c.occurrenceStart.toISOString(),
    })),
  };
}

export async function generateOfferingSessions(offeringId: string, formData: FormData) {
  const { actor } = await loadForEdit(offeringId, "schedule.edit");
  const spec = specFromForm(formData);
  const resourceIds = list(formData, "resourceIds");
  const coachIds = list(formData, "coachIds");
  const capacity = int(formData, "capacity") ?? 8;

  try {
    const created = await createSessions({
      offeringId,
      spec,
      resourceIds,
      coachIds,
      capacity,
      saveAsSeries: spec.kind === "recurring",
      numberDays: spec.kind === "multi_day",
      actorId: actor.id,
    });

    await prisma.offering.update({
      where: { id: offeringId },
      data: {
        scheduleKind: spec.kind === "custom" ? "custom" : (spec.kind as never),
        startDate: created[0]?.startTime ?? null,
        endDate: created[created.length - 1]?.endTime ?? null,
      },
    });

    touch(offeringId);
    return { ok: true as const, count: created.length };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not schedule that." };
  }
}

export async function moveOfferingSession(formData: FormData) {
  const sessionId = str(formData, "sessionId")!;
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { offeringId: true },
  });
  const { actor } = await loadForEdit(session.offeringId!, "schedule.edit");

  const newStart = localDateTime(formData, "newStart");
  const durationMinutes = int(formData, "durationMinutes") ?? 60;
  if (!newStart) return { ok: false as const, error: "Pick a new date and time." };

  try {
    const result = await moveSession({
      sessionId,
      newStart,
      newEnd: new Date(newStart.getTime() + durationMinutes * 60_000),
      scope: (str(formData, "scope") as never) ?? "this",
      reason: str(formData, "reason") ?? undefined,
      notifyFamilies: bool(formData, "notifyFamilies"),
      notifyCoach: bool(formData, "notifyCoach"),
      actorId: actor.id,
    });
    touch(session.offeringId!);
    return { ok: true as const, moved: result.moved };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not move that." };
  }
}

export async function cancelOfferingSession(formData: FormData) {
  const sessionId = str(formData, "sessionId")!;
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { offeringId: true },
  });
  const { actor } = await loadForEdit(session.offeringId!, "schedule.edit");

  const reason = str(formData, "reason");
  if (!reason) return { ok: false as const, error: "A reason is required to cancel." };

  const result = await cancelSession({
    sessionId,
    scope: (str(formData, "scope") as never) ?? "this",
    reason,
    restoreCredits: bool(formData, "restoreCredits"),
    notifyFamilies: bool(formData, "notifyFamilies"),
    notifyCoach: bool(formData, "notifyCoach"),
    actorId: actor.id,
  });
  touch(session.offeringId!);
  return { ok: true as const, ...result };
}

/* ------------------------------------------------------------------- publish */

export async function publishOffering(offeringId: string) {
  const { actor, offering } = await loadForEdit(offeringId, "programs.publish");

  const readiness = await checkReadiness(offeringId);
  if (!readiness.ready) {
    return {
      ok: false as const,
      blockers: readiness.blockers.map((b) => b.label),
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.offering.update({
      where: { id: offeringId },
      data: { status: "published", publishedAt: new Date(), publishedById: actor.id },
    });
    // Keep the pre-Offering `active` flag the old Parent App queries read in
    // sync, rather than leaving a surface reading a field nobody maintains.
    await tx.program.update({ where: { id: offering.programId }, data: { active: true } });
  });

  await auditLog(actor.id, "publish_offering", "offering", offeringId, {});
  touch(offeringId);
  return { ok: true as const };
}

export async function unpublishOffering(offeringId: string, reason: string) {
  const { actor } = await loadForEdit(offeringId, "programs.publish");
  await prisma.offering.update({
    where: { id: offeringId },
    data: { status: "draft", publishedAt: null },
  });
  await auditLog(actor.id, "unpublish_offering", "offering", offeringId, { reason });
  touch(offeringId);
  return { ok: true as const };
}

export async function setOfferingStatus(offeringId: string, status: string) {
  const { actor } = await loadForEdit(offeringId, "programs.publish");
  await prisma.offering.update({
    where: { id: offeringId },
    data: {
      status: status as never,
      ...(status === "archived" ? { archivedAt: new Date() } : {}),
    },
  });
  await auditLog(actor.id, status === "archived" ? "archive_offering" : "publish_offering", "offering", offeringId, { status });
  touch(offeringId);
  return { ok: true as const };
}

/* ------------------------------------------------------------ clone/template */

export async function cloneSeason(offeringId: string, formData: FormData) {
  const { actor } = await loadForEdit(offeringId, "programs.create");
  const clone = await cloneOffering(offeringId, {
    name: str(formData, "name") ?? "Copy",
    seasonLabel: str(formData, "seasonLabel"),
    createdById: actor.id,
  });
  await auditLog(actor.id, "clone_offering", "offering", clone.id, { from: offeringId });
  revalidatePath("/os/programs");
  return { ok: true as const, offeringId: clone.id };
}

export async function saveAsTemplate(offeringId: string, formData: FormData) {
  const { actor } = await loadForEdit(offeringId, "programs.create");
  const name = str(formData, "templateName");
  if (!name) return { ok: false as const, error: "Give the template a name." };
  const template = await captureTemplate(offeringId, name, actor.id);
  return { ok: true as const, templateId: template.id };
}

/* ------------------------------------------------------------------ waitlist */

/// Offers the next free seat to the family at the front of the queue. This is
/// the ONLY admin path from a waitlist to a booking, and it creates an offer —
/// never a registration and never a charge.
export async function offerWaitlistSpot(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { offeringId: true },
  });
  const { actor } = await loadForEdit(session.offeringId!, "registrations.edit");

  await expireStaleOffers();
  const result = await offerNextSpot(sessionId, actor.id);

  if (result.kind === "offered") {
    await auditLog(actor.id, "offer_waitlist_spot", "session", sessionId, {
      athlete: result.athleteName,
      expiresAt: result.expiresAt.toISOString(),
    });
  }
  touch(session.offeringId!);

  switch (result.kind) {
    case "offered":
      return { ok: true as const, message: `Spot offered to ${result.athleteName}. Held until ${result.expiresAt.toLocaleString()}.` };
    case "already_offered":
      return { ok: false as const, message: `${result.athleteName} already has an outstanding offer.` };
    case "no_seat_free":
      return { ok: false as const, message: "That session is full — no seat to offer." };
    case "nobody_waiting":
      return { ok: false as const, message: "Nobody is on the waitlist." };
  }
}

export async function readWaitlist(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: { offeringId: true },
  });
  await loadForEdit(session.offeringId!, "registrations.view");
  return waitlistSummary(sessionId);
}
