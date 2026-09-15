import "server-only";
import { prisma } from "@/lib/prisma";
import { ageFrom } from "@/lib/athlete";
import { athleteScope } from "./dal";
import { can, type OsActor } from "./permissions";

// The searchable/filterable athlete roster Part 1's audit flagged as the
// biggest real gap — "show me all 5th grade girls," "who hasn't signed a
// waiver," "who said no to photo permission" were only answerable via a
// direct database query before this. Mirrors listOfferings' shape
// (lib/programs/queries.ts): one function, a typed filters object, sport
// scoping spread in first via athleteScope — same convention every other OS
// list query already uses.

export type RosterFilters = {
  q?: string;
  grade?: string;
  gender?: string;
  sport?: string;
  waiverStatus?: "signed" | "missing";
  mediaStatus?: "media_ok" | "media_limited" | "media_no" | "none";
};

export type RosterRow = {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  gender: string | null;
  sports: string[];
  age: number;
  familyId: string;
  familyName: string;
  waiverSigned: boolean;
  mediaStatus: "media_ok" | "media_limited" | "media_no" | null;
  membershipPlanName: string | null;
  // Sensitive — only populated when the caller confirms the actor holds
  // families.viewSensitive. Never fetched otherwise (see listAthleteRoster).
  dob: Date | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

/// No pagination pattern exists anywhere in Courts OS today — every list page
/// caps rows with `take: N`. A youth sports facility's roster is realistically
/// hundreds of athletes, not tens of thousands, so this matches that existing
/// convention for the on-screen table. CSV export (below) intentionally does
/// not share this cap — it exists specifically to get everyone out.
const DISPLAY_CAP = 200;
const EXPORT_CAP = 5000;

export async function listAthleteRoster(
  actor: OsActor,
  filters: RosterFilters,
  opts: { forExport?: boolean } = {}
): Promise<RosterRow[]> {
  const seeSensitive = can(actor, "families.viewSensitive");

  const where: Record<string, unknown> = { AND: [athleteScope(actor)] };
  const and = where.AND as unknown[];

  if (filters.grade) and.push({ grade: filters.grade });
  if (filters.gender) and.push({ gender: filters.gender });
  if (filters.sport) and.push({ sports: { has: filters.sport } });
  if (filters.mediaStatus) {
    and.push(
      filters.mediaStatus === "none"
        ? { mediaConsent: null }
        : { mediaConsent: { status: filters.mediaStatus } }
    );
  }
  if (filters.q) {
    and.push({
      OR: [
        { firstName: { contains: filters.q, mode: "insensitive" } },
        { lastName: { contains: filters.q, mode: "insensitive" } },
        { family: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  const athletes = await prisma.athlete.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: opts.forExport ? EXPORT_CAP : DISPLAY_CAP * 3, // headroom for the in-memory waiverStatus filter below
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      gender: true,
      sports: true,
      dob: true,
      familyId: true,
      family: {
        select: {
          name: true,
          guardians: { select: { guardianId: true, isPrimary: true, guardian: { select: { email: true, phone: true } } } },
        },
      },
      mediaConsent: { select: { status: true } },
      memberships: {
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { plan: { select: { name: true } } },
      },
    },
  });

  // Waiver completion is guardian-scoped, not a direct Athlete field (see
  // lib/waivers.ts' getUnsignedRequiredWaivers, whose exact matching logic
  // this batches rather than duplicates a second, possibly-diverging version
  // of): a required waiver counts as signed for this athlete if ANY guardian
  // in their family signed it either for this athlete specifically or
  // family-wide (athleteId null).
  const requiredWaivers = await prisma.waiver.findMany({ where: { required: true }, select: { id: true } });
  const requiredWaiverIds = requiredWaivers.map((w) => w.id);

  let signedByGuardianAndWaiver = new Set<string>(); // `${guardianId}:${waiverId}` for family-wide signatures
  let signedByAthleteAndWaiver = new Set<string>(); // `${athleteId}:${waiverId}` for athlete-specific signatures
  if (requiredWaiverIds.length > 0 && athletes.length > 0) {
    const allGuardianIds = [...new Set(athletes.flatMap((a) => a.family.guardians.map((g) => g.guardianId)))];
    const athleteIds = athletes.map((a) => a.id);
    const signatures = await prisma.waiverSignature.findMany({
      where: {
        waiverId: { in: requiredWaiverIds },
        guardianId: { in: allGuardianIds },
        OR: [{ athleteId: null }, { athleteId: { in: athleteIds } }],
      },
      select: { guardianId: true, athleteId: true, waiverId: true },
    });
    signedByGuardianAndWaiver = new Set(
      signatures.filter((s) => s.athleteId === null).map((s) => `${s.guardianId}:${s.waiverId}`)
    );
    signedByAthleteAndWaiver = new Set(
      signatures.filter((s) => s.athleteId !== null).map((s) => `${s.athleteId}:${s.waiverId}`)
    );
  }

  function isFullySigned(athlete: (typeof athletes)[number]): boolean {
    if (requiredWaiverIds.length === 0) return true;
    const guardianIds = athlete.family.guardians.map((g) => g.guardianId);
    return requiredWaiverIds.every(
      (waiverId) =>
        signedByAthleteAndWaiver.has(`${athlete.id}:${waiverId}`) ||
        guardianIds.some((gid) => signedByGuardianAndWaiver.has(`${gid}:${waiverId}`))
    );
  }

  let rows: RosterRow[] = athletes.map((a) => {
    const primary = a.family.guardians.find((g) => g.isPrimary) ?? a.family.guardians[0];
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      grade: a.grade,
      gender: a.gender,
      sports: a.sports,
      age: ageFrom(a.dob),
      familyId: a.familyId,
      familyName: a.family.name,
      waiverSigned: isFullySigned(a),
      mediaStatus: a.mediaConsent?.status ?? null,
      membershipPlanName: a.memberships[0]?.plan.name ?? null,
      dob: seeSensitive ? a.dob : null,
      guardianEmail: seeSensitive ? (primary?.guardian.email ?? null) : null,
      guardianPhone: seeSensitive ? (primary?.guardian.phone ?? null) : null,
    };
  });

  if (filters.waiverStatus) {
    rows = rows.filter((r) => (filters.waiverStatus === "signed" ? r.waiverSigned : !r.waiverSigned));
  }

  return opts.forExport ? rows : rows.slice(0, DISPLAY_CAP);
}
