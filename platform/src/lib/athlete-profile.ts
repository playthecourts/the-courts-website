import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentGuardian } from "@/lib/dal";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// The parent-side gate for one athlete's profile, and the change log that sits
// behind every sensitive edit.
//
// One athlete record is shared by four applications, so "who is allowed to
// touch this" cannot live in the page that renders the form. Every parent-side
// read and every parent-side write goes through requireGuardianAthlete() below,
// which resolves the athlete THROUGH the signed-in guardian's families rather
// than looking it up by id and checking afterwards. A guardian who edits the
// URL, or replays a server action with another family's athlete id, gets the
// same not-found as a stranger — there is no branch where the id alone is
// enough.
// ---------------------------------------------------------------------------

export class AthleteAccessError extends Error {
  constructor(message = "We couldn't find that athlete.") {
    super(message);
    this.name = "AthleteAccessError";
  }
}

/// Everything the parent-facing profile screens need, in one query.
export const athleteProfileInclude = {
  family: {
    include: {
      guardians: { include: { guardian: true } },
    },
  },
  emergencyContacts: { orderBy: { sortOrder: "asc" } },
  authorizedPickups: { where: { active: true }, orderBy: { createdAt: "asc" } },
  mediaConsent: true,
} satisfies Prisma.AthleteInclude;

export type AthleteProfile = Prisma.AthleteGetPayload<{ include: typeof athleteProfileInclude }>;

/**
 * Resolve an athlete the signed-in guardian is actually allowed to see.
 *
 * The `familyId: { in: ... }` clause is the whole security control: the query
 * can only return an athlete inside one of this guardian's families, so there
 * is no window between fetching and checking.
 */
export async function requireGuardianAthlete(athleteId: string): Promise<{
  athlete: AthleteProfile;
  guardianId: string;
  guardianName: string;
}> {
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.familyId);

  const athlete = await prisma.athlete.findFirst({
    where: { id: athleteId, familyId: { in: familyIds } },
    include: athleteProfileInclude,
  });

  if (!athlete) throw new AthleteAccessError();

  return { athlete, guardianId: guardian.id, guardianName: guardian.name };
}

/// Non-throwing variant for pages that want to render their own not-found.
export async function getGuardianAthleteOrNull(athleteId: string): Promise<AthleteProfile | null> {
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.familyId);
  return prisma.athlete.findFirst({
    where: { id: athleteId, familyId: { in: familyIds } },
    include: athleteProfileInclude,
  });
}

/// The family a new athlete should be created in. A guardian always has one —
/// signup creates it — and this deliberately reuses it rather than creating a
/// second family for a second child.
export async function primaryFamilyIdFor(guardianId: string): Promise<string> {
  const link =
    (await prisma.familyGuardian.findFirst({
      where: { guardianId, isPrimary: true },
      select: { familyId: true },
    })) ??
    (await prisma.familyGuardian.findFirst({
      where: { guardianId },
      select: { familyId: true },
    }));

  if (!link) throw new AthleteAccessError("No family is set up for this account yet.");
  return link.familyId;
}

// ---------------------------------------------------------------------------
// Change history
//
// AuditLog covers staff actions and requires a staff id. Parents change these
// same fields, so a second, actor-agnostic trail is needed — "who changed the
// pickup list" has to be answerable whichever app did it.
//
// Values are recorded only for the categories where the old value is the point
// (a consent status, a pickup name). Medical and custody free text is logged as
// "changed", never copied: an audit table full of children's medical details
// would be a second unguarded copy of the most sensitive text in the system.
// ---------------------------------------------------------------------------

export const SENSITIVE_CATEGORIES = [
  "media_consent",
  "guardians",
  "emergency",
  "pickup",
  "custody",
  "medical",
] as const;

export type ProfileChangeCategory = (typeof SENSITIVE_CATEGORIES)[number] | "profile";

const REDACTED_CATEGORIES = new Set<ProfileChangeCategory>(["medical", "custody"]);

export type ProfileChangeActor =
  | { type: "guardian"; id: string; label: string }
  | { type: "staff"; id: string; label: string }
  | { type: "system"; label: string };

export async function recordProfileChange(params: {
  athleteId: string;
  actor: ProfileChangeActor;
  category: ProfileChangeCategory;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  const redact = REDACTED_CATEGORIES.has(params.category);
  try {
    await prisma.athleteProfileChange.create({
      data: {
        athleteId: params.athleteId,
        actorType: params.actor.type,
        actorGuardianId: params.actor.type === "guardian" ? params.actor.id : null,
        actorStaffId: params.actor.type === "staff" ? params.actor.id : null,
        actorLabel: params.actor.label,
        category: params.category,
        field: params.field,
        oldValue: redact ? summarize(params.oldValue) : (params.oldValue ?? null),
        newValue: redact ? summarize(params.newValue) : (params.newValue ?? null),
      },
    });
  } catch (err) {
    // Same posture as lib/audit.ts: never fail a parent's save because the
    // history write failed.
    console.error("[athlete-profile] failed to record change", params.field, err);
  }
}

/// "not set" / "on file" — enough to reconstruct WHEN something was added or
/// removed without storing WHAT it said.
function summarize(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? "on file" : "not set";
}

/// Convenience for the common shape: log only when the value actually moved.
export async function recordIfChanged(params: {
  athleteId: string;
  actor: ProfileChangeActor;
  category: ProfileChangeCategory;
  field: string;
  before: string | null | undefined;
  after: string | null | undefined;
}) {
  const before = params.before ?? null;
  const after = params.after ?? null;
  if (before === after) return;
  await recordProfileChange({
    athleteId: params.athleteId,
    actor: params.actor,
    category: params.category,
    field: params.field,
    oldValue: before,
    newValue: after,
  });
}
