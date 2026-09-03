import "server-only";
import { prisma } from "@/lib/prisma";

export class WaiverRequiredError extends Error {
  constructor(waiverType: string) {
    super(`The "${waiverType}" waiver must be signed before booking.`);
    this.name = "WaiverRequiredError";
  }
}

// A family-scope waiver needs one signature from the guardian (covers every
// athlete); an athlete-scope waiver needs one signature naming that specific
// athlete. Returns the required waivers this guardian/athlete pair hasn't
// cleared yet.
export async function getUnsignedRequiredWaivers(guardianId: string, athleteId: string) {
  const requiredWaivers = await prisma.waiver.findMany({ where: { required: true } });
  if (requiredWaivers.length === 0) return [];

  const signatures = await prisma.waiverSignature.findMany({
    where: {
      waiverId: { in: requiredWaivers.map((w) => w.id) },
      guardianId,
      OR: [{ athleteId: null }, { athleteId }],
    },
  });
  const signedWaiverIds = new Set(signatures.map((s) => s.waiverId));

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
