import "server-only";
import { prisma } from "@/lib/prisma";

export class WaiverRequiredError extends Error {
  constructor(waiverType: string) {
    super(`The "${waiverType}" waiver must be signed before booking.`);
    this.name = "WaiverRequiredError";
  }
}

// An athlete-scope waiver needs a signature naming that specific athlete
// directly. A family-scope waiver needs this athlete's id to appear in the
// WaiverSignatureAthlete coverage of at least one of this guardian's
// signatures for it — NOT "any family-scope signature by this guardian",
// which is the old (deliberately retired) behavior that silently covered
// athletes added after the fact. Returns the required waivers this
// guardian/athlete pair hasn't cleared yet.
export async function getUnsignedRequiredWaivers(guardianId: string, athleteId: string) {
  const requiredWaivers = await prisma.waiver.findMany({ where: { required: true } });
  if (requiredWaivers.length === 0) return [];

  const [athleteScopeSignatures, coverage] = await Promise.all([
    prisma.waiverSignature.findMany({
      where: { waiverId: { in: requiredWaivers.map((w) => w.id) }, guardianId, athleteId },
      select: { waiverId: true },
    }),
    prisma.waiverSignatureAthlete.findMany({
      where: {
        athleteId,
        waiverSignature: { guardianId, waiverId: { in: requiredWaivers.map((w) => w.id) } },
      },
      select: { waiverSignature: { select: { waiverId: true } } },
    }),
  ]);

  const signedWaiverIds = new Set([
    ...athleteScopeSignatures.map((s) => s.waiverId),
    ...coverage.map((c) => c.waiverSignature.waiverId),
  ]);

  return requiredWaivers.filter((w) => !signedWaiverIds.has(w.id));
}

// Used by the booking action — throws rather than returning a boolean so a
// missed check fails loudly instead of silently letting a booking through.
export async function assertWaiversSigned(guardianId: string, athleteId: string) {
  const unsigned = await getUnsignedRequiredWaivers(guardianId, athleteId);
  if (unsigned.length > 0) {
    throw new WaiverRequiredError(unsigned[0].waiverType);
  }
}

export type WaiverCoverageSummary = {
  waiver: { id: string; waiverType: string; version: string; content: string; scope: string; required: boolean };
  /// Athlete ids covered by at least one of this guardian's signatures for
  /// this waiver — the union across every signing event, never just the
  /// most recent one.
  coveredAthleteIds: Set<string>;
  /// Athletes from the guardian's current list NOT in coveredAthleteIds —
  /// exactly who a new signing event still needs to cover, including anyone
  /// added to the account after the last signature.
  uncoveredAthleteIds: Set<string>;
  mostRecentSignedAt: Date | null;
  mostRecentSignedName: string | null;
  /// The exact text/version the most recent signature actually accepted —
  /// not waiver.content, which may have been edited since. Null only for
  /// signatures that predate this field (see the schema comment).
  mostRecentAcceptedContent: string | null;
  mostRecentAcceptedVersion: string | null;
};

/// One summary per Waiver (all of them, not just required — the family page
/// shows optional ones too, marked as such), for the guardian's current
/// athlete list. Powers both the sign form ("this waiver applies to: only
/// the uncovered ones") and the completed-state view ("Covers: ...").
export async function getWaiverCoverageSummaries(
  guardianId: string,
  athleteIds: string[]
): Promise<WaiverCoverageSummary[]> {
  const waivers = await prisma.waiver.findMany({ orderBy: { waiverType: "asc" } });
  if (waivers.length === 0) return [];

  const waiverIds = waivers.map((w) => w.id);

  const [athleteScopeSignatures, familySignatures] = await Promise.all([
    prisma.waiverSignature.findMany({
      where: { waiverId: { in: waiverIds }, guardianId, athleteId: { in: athleteIds } },
      select: {
        waiverId: true,
        athleteId: true,
        signedAt: true,
        signedName: true,
        acceptedContent: true,
        acceptedVersion: true,
      },
    }),
    prisma.waiverSignature.findMany({
      where: { waiverId: { in: waiverIds }, guardianId, athleteId: null },
      select: {
        waiverId: true,
        signedAt: true,
        signedName: true,
        acceptedContent: true,
        acceptedVersion: true,
        coveredAthletes: { select: { athleteId: true } },
      },
    }),
  ]);

  return waivers.map((waiver) => {
    const coveredAthleteIds = new Set<string>();
    let mostRecentSignedAt: Date | null = null;
    let mostRecentSignedName: string | null = null;
    let mostRecentAcceptedContent: string | null = null;
    let mostRecentAcceptedVersion: string | null = null;

    const consider = (
      signedAt: Date,
      signedName: string,
      acceptedContent: string | null,
      acceptedVersion: string | null
    ) => {
      if (!mostRecentSignedAt || signedAt > mostRecentSignedAt) {
        mostRecentSignedAt = signedAt;
        mostRecentSignedName = signedName;
        mostRecentAcceptedContent = acceptedContent;
        mostRecentAcceptedVersion = acceptedVersion;
      }
    };

    for (const s of athleteScopeSignatures) {
      if (s.waiverId !== waiver.id || !s.athleteId) continue;
      coveredAthleteIds.add(s.athleteId);
      consider(s.signedAt, s.signedName, s.acceptedContent, s.acceptedVersion);
    }
    for (const s of familySignatures) {
      if (s.waiverId !== waiver.id) continue;
      let touchedThisAthlete = false;
      for (const c of s.coveredAthletes) {
        if (athleteIds.includes(c.athleteId)) {
          coveredAthleteIds.add(c.athleteId);
          touchedThisAthlete = true;
        }
      }
      if (touchedThisAthlete) consider(s.signedAt, s.signedName, s.acceptedContent, s.acceptedVersion);
    }

    const uncoveredAthleteIds = new Set(athleteIds.filter((id) => !coveredAthleteIds.has(id)));

    return {
      waiver,
      coveredAthleteIds,
      uncoveredAthleteIds,
      mostRecentSignedAt,
      mostRecentSignedName,
      mostRecentAcceptedContent,
      mostRecentAcceptedVersion,
    };
  });
}
