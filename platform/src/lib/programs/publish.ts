import "server-only";
import { prisma } from "@/lib/prisma";
import { programTypeDef } from "./types";
import { findConflicts, blockingOnly, type Conflict } from "./conflicts";

// ---------------------------------------------------------------------------
// Publish readiness.
//
// The question this answers is not "is the form filled in" but "will a family
// hitting this in the Parent App have a working experience". A published
// offering with no price, no Stripe setup, no coach or no waiver is a broken
// experience that reaches a parent — so those are blockers, not warnings.
//
// Blockers list the exact thing to fix and where. "Not ready" with no reason is
// the failure mode this is written to avoid.
// ---------------------------------------------------------------------------

export type ReadinessIssue = {
  severity: "blocker" | "warning";
  /// Short, imperative. Rendered as a list item.
  label: string;
  /// Which builder section to open.
  group: string;
};

export type Readiness = {
  ready: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  conflicts: Conflict[];
  sessionCount: number;
};

export async function checkReadiness(offeringId: string): Promise<Readiness> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: {
      program: true,
      requiredWaivers: { select: { waiverId: true } },
      sessions: {
        where: { status: "scheduled" },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          capacity: true,
          resourceId: true,
          extraResources: { select: { resourceId: true } },
          coaches: { select: { staffUserId: true } },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  const def = programTypeDef(offering.program.programType);
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // --- Identity + copy ---
  if (!offering.name.trim()) blockers.push({ severity: "blocker", label: "Add a public name", group: "basics" });
  if (!offering.shortDescription?.trim()) {
    blockers.push({
      severity: "blocker",
      label: "Add short card copy — it's what families see first",
      group: "copy",
    });
  }
  if (!offering.fullDescription?.trim()) {
    warnings.push({ severity: "warning", label: "No full description", group: "copy" });
  }
  if (!offering.imageUrl) {
    // Not a blocker: a branded fallback renders instead of a broken card.
    warnings.push({ severity: "warning", label: "No featured image — a branded fallback will be used", group: "copy" });
  } else if (!offering.imageAltText?.trim()) {
    warnings.push({ severity: "warning", label: "Image has no alt text", group: "copy" });
  }

  // --- Schedule ---
  if (offering.sessions.length === 0) {
    blockers.push({ severity: "blocker", label: "No sessions scheduled yet", group: "schedule" });
  }
  const past = offering.sessions.filter((s) => s.startTime < new Date()).length;
  if (past > 0 && past === offering.sessions.length) {
    warnings.push({
      severity: "warning",
      label: "Every session is in the past",
      group: "schedule",
    });
  }

  // --- Resource ---
  if (def.defaults.requiredResourceType) {
    const needed = def.defaults.requiredResourceType;
    const resourceIds = [
      ...new Set(
        offering.sessions.flatMap((s) =>
          [s.resourceId, ...s.extraResources.map((e) => e.resourceId)].filter(Boolean)
        ) as string[]
      ),
    ];
    const matching = resourceIds.length
      ? await prisma.resource.count({ where: { id: { in: resourceIds }, resourceType: needed } })
      : 0;
    if (matching === 0) {
      blockers.push({
        severity: "blocker",
        label: `This program type needs a ${needed.replace(/_/g, " ")} reserved`,
        group: "resource",
      });
    }
  }
  const missingResource = offering.sessions.filter(
    (s) => !s.resourceId && s.extraResources.length === 0
  ).length;
  if (missingResource > 0) {
    warnings.push({
      severity: "warning",
      label: `${missingResource} session${missingResource === 1 ? " has" : "s have"} no court assigned`,
      group: "schedule",
    });
  }

  // --- Staffing ---
  if (offering.program.requiresCoach || def.defaults.requiresCoach) {
    const unstaffed = offering.sessions.filter((s) => s.coaches.length === 0).length;
    if (unstaffed > 0) {
      blockers.push({
        severity: "blocker",
        label: `NO COACH ASSIGNED — ${unstaffed} session${unstaffed === 1 ? "" : "s"}`,
        group: "staffing",
      });
    }
  }

  // --- Capacity ---
  if (offering.sessions.some((s) => s.capacity <= 0) ) {
    blockers.push({ severity: "blocker", label: "A session has zero capacity", group: "capacity" });
  }

  // --- Eligibility ---
  if (def.defaults.hasEligibility && offering.gradeMin === null && offering.ageMin === null) {
    warnings.push({
      severity: "warning",
      label: "No grade or age range — every family will see this",
      group: "eligibility",
    });
  }

  // --- Money. The most consequential checks: a broken checkout reaches parents. ---
  const isPaid = offering.pricingModel !== "free";
  if (isPaid) {
    if (offering.priceCents === null || offering.priceCents <= 0) {
      blockers.push({ severity: "blocker", label: "NO PRICE CONFIGURED", group: "pricing" });
    }
    if (!offering.stripePriceId) {
      blockers.push({
        severity: "blocker",
        label: "STRIPE NOT CONNECTED — checkout would fail",
        group: "pricing",
      });
    }
    if (!offering.stripeTaxCode) {
      blockers.push({ severity: "blocker", label: "TAX SETUP REQUIRED", group: "pricing" });
    }
    if (offering.taxBehavior === "unspecified") {
      warnings.push({
        severity: "warning",
        label: "Tax behavior is unspecified — Stripe will use the account default",
        group: "pricing",
      });
    }
    if (
      offering.creditRule === "member_price" &&
      (offering.memberPriceCents === null || offering.memberPriceCents <= 0)
    ) {
      blockers.push({
        severity: "blocker",
        label: "Member pricing is on but no member price is set",
        group: "pricing",
      });
    }
    if (offering.allowSingleDay && !offering.singleDayPriceCents) {
      blockers.push({
        severity: "blocker",
        label: "Single-day registration is on but has no price",
        group: "pricing",
      });
    }
  }

  // --- Paperwork ---
  if (offering.requiredWaivers.length === 0) {
    const anyRequired = await prisma.waiver.count({ where: { required: true } });
    if (anyRequired > 0) {
      warnings.push({ severity: "warning", label: "MISSING WAIVER — none attached", group: "forms" });
    }
  }

  // --- Visibility ---
  if (
    !offering.visibleParentApp &&
    !offering.visibleWebsite &&
    !offering.visibleCoachApp &&
    !offering.internalOnly
  ) {
    blockers.push({
      severity: "blocker",
      label: "No publish target selected — this would go nowhere",
      group: "publishing",
    });
  }

  // --- Conflicts, against everything already on the calendar. ---
  const conflicts = await findConflicts(
    offering.sessions.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      resourceIds: [s.resourceId, ...s.extraResources.map((e) => e.resourceId)].filter(
        Boolean
      ) as string[],
      coachIds: s.coaches.map((c) => c.staffUserId),
      excludeSessionId: s.id,
    })),
    { programType: offering.program.programType }
  );
  // Soft conflicts already overridden by an admin shouldn't keep re-blocking.
  const overridden = await prisma.conflictOverride.findMany({
    where: { sessionId: { in: offering.sessions.map((s) => s.id) } },
    select: { conflictType: true },
  });
  const overriddenTypes = new Set(overridden.map((o) => o.conflictType));
  const liveConflicts = conflicts.filter((c) => !overriddenTypes.has(c.type));

  for (const c of blockingOnly(liveConflicts)) {
    blockers.push({ severity: "blocker", label: c.message, group: "schedule" });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    conflicts: liveConflicts,
    sessionCount: offering.sessions.length,
  };
}
