"use server";

import { prisma } from "@/lib/prisma";
import { requireCapability, assertForSport } from "@/lib/os/dal";

export type RosterRow = {
  athleteId: string;
  name: string;
  grade: string | null;
  here: boolean;
  due: boolean;
};

/// Who is in one class, for the Schedule's session popup. Same scoping as
/// Class Rosters (registrations.view, by sport).
export async function getSessionRoster(sessionId: string): Promise<{ ok: true; rows: RosterRow[] } | { ok: false; error: string }> {
  try {
    const actor = await requireCapability("registrations.view");
    const s = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        program: { select: { sport: true } },
        bookings: {
          where: { status: { not: "cancelled" } },
          orderBy: { bookedAt: "asc" },
          select: {
            status: true,
            paymentStatus: true,
            athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, grade: true } },
          },
        },
      },
    });
    if (!s) return { ok: false, error: "That class no longer exists." };
    assertForSport(actor, "registrations.view", s.program.sport);
    return {
      ok: true,
      rows: s.bookings.map((b) => ({
        athleteId: b.athlete.id,
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
