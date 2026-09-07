import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "@/lib/os/permissions";
import { can, scopedSports } from "@/lib/os/permissions";
import { staffMediaLabel, needsPhotographerAttention } from "@/lib/media-consent";
import type { MediaConsentStatus } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Staff-facing media permissions.
//
// Everything here answers one operational question: before a camera comes out,
// who is it okay to photograph? So it returns two words per athlete and nothing
// more. The release text, the consent history and the guardian's identity are
// deliberately NOT in these payloads — a coach on the floor needs the status,
// not the paperwork.
//
// An athlete whose parent has not answered is treated as "ask first", never as
// a yes. Silence is not consent.
// ---------------------------------------------------------------------------

export type MediaRosterEntry = {
  athleteId: string;
  firstName: string;
  lastName: string;
  status: MediaConsentStatus | null;
  label: string;
  needsAttention: boolean;
};

export type MediaRosterSummary = {
  total: number;
  ok: number;
  askFirst: number;
  no: number;
  unanswered: number;
  /// Everyone a photographer needs to know about — anything that isn't a
  /// clear yes.
  attention: MediaRosterEntry[];
  entries: MediaRosterEntry[];
};

function toEntry(a: {
  id: string;
  firstName: string;
  lastName: string;
  mediaConsent: { status: MediaConsentStatus } | null;
}): MediaRosterEntry {
  const status = a.mediaConsent?.status ?? null;
  return {
    athleteId: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    status,
    label: staffMediaLabel(status),
    needsAttention: needsPhotographerAttention(status),
  };
}

function summarize(entries: MediaRosterEntry[]): MediaRosterSummary {
  return {
    total: entries.length,
    ok: entries.filter((e) => e.status === "media_ok").length,
    askFirst: entries.filter((e) => e.status === "media_limited").length,
    no: entries.filter((e) => e.status === "media_no").length,
    unanswered: entries.filter((e) => e.status === null).length,
    attention: entries.filter((e) => e.needsAttention),
    entries,
  };
}

/// Media permissions for everyone booked into one session. This is the list a
/// coach or photographer checks before a shoot.
export async function sessionMediaRoster(sessionId: string): Promise<MediaRosterSummary> {
  const bookings = await prisma.booking.findMany({
    where: { sessionId, status: { not: "cancelled" } },
    select: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mediaConsent: { select: { status: true } },
        },
      },
    },
    orderBy: { athlete: { firstName: "asc" } },
  });
  return summarize(bookings.map((b) => toEntry(b.athlete)));
}

/// Media permissions across a whole offering — every athlete booked into any of
/// its sessions, counted once. This is the "Fall Break Camp: 28 athletes,
/// 24 Media OK" view.
export async function offeringMediaRoster(offeringId: string): Promise<MediaRosterSummary> {
  const bookings = await prisma.booking.findMany({
    where: { session: { offeringId }, status: { not: "cancelled" } },
    select: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mediaConsent: { select: { status: true } },
        },
      },
    },
  });

  // An athlete booked into four camp days is one person, not four.
  const seen = new Map<string, MediaRosterEntry>();
  for (const b of bookings) if (!seen.has(b.athlete.id)) seen.set(b.athlete.id, toEntry(b.athlete));
  const entries = [...seen.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));
  return summarize(entries);
}

/// The Courts OS media permissions list, filterable. Sport-scoped for a head
/// coach the same way every other OS read is.
export async function listMediaPermissions(
  actor: OsActor,
  filter: { status?: string; q?: string } = {}
) {
  const sports = scopedSports(actor);
  const scope =
    sports && sports.length > 0
      ? {
          OR: [
            { bookings: { some: { session: { program: { sport: { in: sports } } } } } },
            { teamMemberships: { some: { team: { program: { sport: { in: sports } } } } } },
          ],
        }
      : {};

  const statusFilter =
    filter.status === "unanswered"
      ? { mediaConsent: { is: null } }
      : filter.status
        ? { mediaConsent: { status: filter.status as MediaConsentStatus } }
        : {};

  const athletes = await prisma.athlete.findMany({
    where: {
      AND: [
        scope,
        statusFilter,
        filter.q
          ? {
              OR: [
                { firstName: { contains: filter.q, mode: "insensitive" as const } },
                { lastName: { contains: filter.q, mode: "insensitive" as const } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ firstName: "asc" }],
    take: 300,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      mediaConsent: {
        select: {
          status: true,
          consentDate: true,
          releaseVersion: true,
          guardianName: true,
          // Only shown to roles that may see consent detail; the page gates it.
          guardianRelationship: true,
        },
      },
    },
  });

  return athletes;
}

/// Withdrawals that still need a human to review already-published material.
/// The system never claims content was removed on its own.
export async function openMediaFollowUps() {
  return prisma.mediaConsentChange.findMany({
    where: { needsFollowUp: true, followUpDoneAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      athlete: { select: { id: true, firstName: true, lastName: true } },
      guardian: { select: { name: true } },
    },
  });
}

/// Whether this actor may see WHO consented and when, as opposed to the
/// operational two-word status. Marketing gets the status and nothing else.
export function canSeeConsentDetail(actor: OsActor): boolean {
  return can(actor, "families.viewSensitive");
}
