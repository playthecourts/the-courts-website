"use server";

import { prisma } from "@/lib/prisma";
import { requireCapability, assertForSport } from "@/lib/os/dal";
import { canForSport } from "@/lib/os/permissions";
import { formatGrade } from "@/lib/coach-format";

export type RosterRow = {
  athleteId: string;
  bookingId: string;
  name: string;
  grade: string | null;
  here: boolean;
  due: boolean;
};

export type SessionRoster = {
  ok: true;
  rows: RosterRow[];
  /// Staff who can check kids in / add them (same rule as Class Rosters).
  canEdit: boolean;
  /// Everyone not already in this class, for the popup's "Add athlete" search.
  addable: { id: string; label: string }[];
};

/// Who is in one class, for the Schedule's session popup. Same scoping as
/// Class Rosters (registrations.view, by sport). Sorted by last name so the
/// list reads like the roster sheet, not in sign-up order.
export async function getSessionRoster(sessionId: string): Promise<SessionRoster | { ok: false; error: string }> {
  try {
    const actor = await requireCapability("registrations.view");
    const s = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        program: { select: { sport: true } },
        bookings: {
          where: { status: { not: "cancelled" } },
          orderBy: [{ athlete: { lastName: "asc" } }, { athlete: { firstName: "asc" } }],
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, grade: true } },
          },
        },
      },
    });
    if (!s) return { ok: false, error: "That class no longer exists." };
    assertForSport(actor, "registrations.view", s.program.sport);

    const canEdit = canForSport(actor, "registrations.create", s.program.sport);

    const inClass = new Set(s.bookings.map((b) => b.athlete.id));
    const addable = canEdit
      ? (
          await prisma.athlete.findMany({
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: { id: true, firstName: true, nickname: true, lastName: true, grade: true },
          })
        )
          .filter((a) => !inClass.has(a.id))
          .map((a) => ({
            id: a.id,
            label: `${a.lastName}, ${a.nickname || a.firstName}${a.grade ? ` · ${formatGrade(a.grade)}` : ""}`,
          }))
      : [];

    return {
      ok: true,
      canEdit,
      addable,
      rows: s.bookings.map((b) => ({
        athleteId: b.athlete.id,
        bookingId: b.id,
        name: `${b.athlete.nickname?.trim() || b.athlete.firstName} ${b.athlete.lastName}`,
        grade: b.athlete.grade,
        here: b.status === "attended",
        due: b.paymentStatus === "due" || b.paymentStatus === "pending",
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't load the roster." };
  }
}
