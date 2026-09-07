import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, StaffUser } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// The Coach App's authorization layer.
//
// This is the ONLY place coach access rules are expressed. Every /coach page
// and every coach server action goes through it — nothing relies on a hidden
// UI element to keep a coach out of data. A coach who edits a URL or replays a
// server action with someone else's session/athlete/team id hits the same
// checks the UI does, because the checks live here, on the server, not in the
// component that renders the button.
//
// Three tiers:
//   admin       — everything.
//   head_coach  — everything within StaffUser.sports (their sport only).
//   coach       — only what they are explicitly assigned: SessionCoach rows,
//                 TeamCoach rows, and the athletes inside those.
//
// front_desk is intentionally NOT a Coach App role; they use /admin.
// ---------------------------------------------------------------------------

export type CoachActor = StaffUser & {
  isAdmin: boolean;
  isHeadCoach: boolean;
  /** Sports this actor may act on. Empty array + isAdmin means "all sports". */
  scopedSports: string[];
  /** True only for admin — head coaches are deliberately sport-limited. */
  seesAllSports: boolean;
};

function decorate(staff: StaffUser): CoachActor {
  const isAdmin = staff.role === "admin";
  const isHeadCoach = staff.role === "head_coach";
  return {
    ...staff,
    isAdmin,
    isHeadCoach,
    scopedSports: staff.sports,
    seesAllSports: isAdmin,
  };
}

/**
 * The real, DB-backed gate for every /coach route. proxy.ts only confirms
 * someone is signed in; this confirms they are active staff with a coaching
 * role. Mirrors getCurrentStaff() in admin-dal.ts deliberately — same pattern,
 * different trust boundary.
 */
export async function getCurrentCoach(): Promise<CoachActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/coach/login");

  const staff = await prisma.staffUser.findUnique({ where: { authId: user.id } });

  // A guardian (or anyone else) hitting /coach by URL is not staff at all.
  if (!staff) redirect("/coach/login?error=not-staff");
  if (!staff.active) redirect("/coach/login?error=inactive");
  if (staff.role === "front_desk") redirect("/coach/login?error=no-coach-access");

  return decorate(staff);
}

/** Non-redirecting variant, for deciding where to send someone after login. */
export async function getCoachOrNull(): Promise<CoachActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const staff = await prisma.staffUser.findUnique({ where: { authId: user.id } });
  if (!staff || !staff.active || staff.role === "front_desk") return null;
  return decorate(staff);
}

// ---------------------------------------------------------------------------
// Scope filters — the query-level half of the model.
//
// These return Prisma `where` fragments so that scoping happens IN the database
// query rather than by fetching everything and filtering in JS. That matters:
// a filter applied after the fact is one forgotten `.filter()` away from a leak.
// ---------------------------------------------------------------------------

/** Sessions this actor may see. */
export function sessionScope(actor: CoachActor): Prisma.SessionWhereInput {
  if (actor.isAdmin) return {};

  // A coach is always allowed to see a session they're personally assigned to,
  // or one belonging to a team they coach — this clause applies to head
  // coaches too, so a head coach covering another sport's session as a
  // substitute can still open the session they were actually assigned.
  const assigned: Prisma.SessionWhereInput = {
    OR: [
      { coaches: { some: { staffUserId: actor.id } } },
      { team: { coaches: { some: { staffUserId: actor.id } } } },
    ],
  };

  if (actor.isHeadCoach) {
    return {
      OR: [
        // Their sport, across every coach in it.
        { program: { sport: { in: actor.scopedSports } } },
        ...(assigned.OR as Prisma.SessionWhereInput[]),
      ],
    };
  }

  return assigned;
}

/**
 * Athletes this actor may see.
 *
 * Note what is NOT here: there is no "all athletes" branch for a plain coach.
 * A coach reaches an athlete only through a session they work or a team they
 * coach — they cannot browse the Courts customer database, and search
 * (which composes this same filter) cannot be used to get around it.
 */
export function athleteScope(actor: CoachActor): Prisma.AthleteWhereInput {
  if (actor.isAdmin) return {};

  if (actor.isHeadCoach) {
    return {
      OR: [
        { bookings: { some: { session: { program: { sport: { in: actor.scopedSports } } } } } },
        { teamMemberships: { some: { team: { program: { sport: { in: actor.scopedSports } } } } } },
        { bookings: { some: { session: { coaches: { some: { staffUserId: actor.id } } } } } },
        { teamMemberships: { some: { team: { coaches: { some: { staffUserId: actor.id } } } } } },
      ],
    };
  }

  return {
    OR: [
      { bookings: { some: { session: { coaches: { some: { staffUserId: actor.id } } } } } },
      { teamMemberships: { some: { team: { coaches: { some: { staffUserId: actor.id } } } } } },
    ],
  };
}

/** Teams this actor may see. */
export function teamScope(actor: CoachActor): Prisma.TeamWhereInput {
  if (actor.isAdmin) return {};
  if (actor.isHeadCoach) {
    return {
      OR: [
        { program: { sport: { in: actor.scopedSports } } },
        { coaches: { some: { staffUserId: actor.id } } },
      ],
    };
  }
  return { coaches: { some: { staffUserId: actor.id } } };
}

/** Programs this actor may see. */
export function programScope(actor: CoachActor): Prisma.ProgramWhereInput {
  if (actor.isAdmin) return {};
  if (actor.isHeadCoach) {
    return {
      OR: [
        { sport: { in: actor.scopedSports } },
        { sessions: { some: { coaches: { some: { staffUserId: actor.id } } } } },
        { teams: { some: { coaches: { some: { staffUserId: actor.id } } } } },
      ],
    };
  }
  return {
    OR: [
      { sessions: { some: { coaches: { some: { staffUserId: actor.id } } } } },
      { teams: { some: { coaches: { some: { staffUserId: actor.id } } } } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Assertions — the record-level half.
//
// Every one of these composes the scope filter above with the requested id and
// asks the database. If the row doesn't come back inside the actor's scope,
// access is denied.
// ---------------------------------------------------------------------------

/**
 * Every denial lands on the same branded screen via redirect(), whether the
 * record is out of scope or simply doesn't exist. Two reasons for one shared
 * outcome: a coach can't probe for the existence of another sport's data by
 * comparing responses, and the deny is a real server-side navigation that's
 * trivial to verify in QA (scenario 20) rather than a silently empty page.
 *
 * redirect() works identically in Server Components and Server Actions, so
 * the same assertion guards both the page render and the action behind it.
 */
export async function assertSessionAccess(actor: CoachActor, sessionId: string) {
  const found = await prisma.session.findFirst({
    where: { AND: [{ id: sessionId }, sessionScope(actor)] },
    select: { id: true },
  });
  if (!found) redirect("/coach/no-access");
  return sessionId;
}

export async function assertAthleteAccess(actor: CoachActor, athleteId: string) {
  const found = await prisma.athlete.findFirst({
    where: { AND: [{ id: athleteId }, athleteScope(actor)] },
    select: { id: true },
  });
  if (!found) redirect("/coach/no-access");
  return athleteId;
}

export async function assertTeamAccess(actor: CoachActor, teamId: string) {
  const found = await prisma.team.findFirst({
    where: { AND: [{ id: teamId }, teamScope(actor)] },
    select: { id: true },
  });
  if (!found) redirect("/coach/no-access");
  return teamId;
}

export async function assertProgramAccess(actor: CoachActor, programId: string) {
  const found = await prisma.program.findFirst({
    where: { AND: [{ id: programId }, programScope(actor)] },
    select: { id: true },
  });
  if (!found) redirect("/coach/no-access");
  return programId;
}

/** Capability denial (e.g. a plain coach trying a head-coach-only action). */
export function denyUnlessLeadership(actor: CoachActor) {
  if (!isLeadership(actor)) redirect("/coach/no-access");
}

export function denyUnlessManagesSport(actor: CoachActor, sport: string | null) {
  if (!canManageSport(actor, sport)) redirect("/coach/no-access");
}

// ---------------------------------------------------------------------------
// Capability checks — "may this actor DO this", as opposed to "may they see it".
//
// Seeing a session and being allowed to change its capacity are different
// questions, and a plain coach answers yes to the first and no to the second.
// ---------------------------------------------------------------------------

/** Manage operations for a sport (assign coaches, build teams, announce). */
export function canManageSport(actor: CoachActor, sport: string | null): boolean {
  if (actor.isAdmin) return true;
  if (!actor.isHeadCoach) return false;
  if (!sport) return false;
  return actor.scopedSports.includes(sport);
}

/** Head coach or admin — the "more than my own court" tier. */
export function isLeadership(actor: CoachActor): boolean {
  return actor.isAdmin || actor.isHeadCoach;
}

/** Capacity, closing/reopening registration, waitlist offers. */
export function canManageCapacity(actor: CoachActor, sport: string | null): boolean {
  return canManageSport(actor, sport);
}

/** Assigning coaches, resolving coverage requests, building teams. */
export function canManageStaffing(actor: CoachActor, sport: string | null): boolean {
  return canManageSport(actor, sport);
}

/**
 * Refunds, discounts, coupons and any financial adjustment are Admin-only and
 * are not implemented in the Coach App at all — this exists so the rule is
 * stated in code rather than only in a doc.
 */
export function canAdjustFinancials(actor: CoachActor): boolean {
  return actor.isAdmin;
}

/**
 * Emergency contact + medical notes. Every assigned coach genuinely needs
 * these courtside, so access is allowed — but it is never rendered by default
 * and every reveal is written to AuditLog (see lib/audit.ts). Restricting it
 * further would be unsafe; logging it is the right control.
 */
export function canViewEmergencyInfo(actor: CoachActor): boolean {
  return actor.isAdmin || actor.isHeadCoach || actor.role === "coach";
}

/** Sports this actor can switch between in the schedule's scope picker. */
export function selectableSports(actor: CoachActor): string[] {
  if (actor.isAdmin) return ["Basketball", "Volleyball"];
  if (actor.isHeadCoach) return actor.scopedSports;
  return [];
}
