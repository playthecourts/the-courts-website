import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  type Capability,
  type OsActor,
  can,
  canForSport,
  scopedSports,
} from "./permissions";

// ---------------------------------------------------------------------------
// The enforcement half of the authorization model. permissions.ts states the
// policy; this file is where a request actually gets stopped.
//
// Every Courts OS page calls getOsActor() (or requireCapability()), and every
// server action calls requireCapability() again — actions are their own
// endpoints and are reachable without ever rendering the page that hides the
// button, so re-checking there is not belt-and-braces, it is the actual gate.
// ---------------------------------------------------------------------------

export class OsAccessError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
    this.name = "OsAccessError";
  }
}

function toActor(staff: {
  id: string;
  name: string;
  email: string;
  role: OsActor["role"];
  sports: string[];
  active: boolean;
}): OsActor {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    sports: staff.sports,
    active: staff.active,
  };
}

/// The gate for every /os route. proxy.ts only confirms someone is signed in.
export async function getOsActor(): Promise<OsActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/os");

  const staff = await prisma.staffUser.findUnique({ where: { authId: user.id } });

  // A guardian who types /os gets the same answer as a stranger.
  if (!staff) redirect("/login?error=not-staff");
  if (!staff.active) redirect("/login?error=inactive");

  const actor = toActor(staff);
  if (!can(actor, "os.access")) redirect("/login?error=no-os-access");

  return actor;
}

/// Non-redirecting variant, for deciding where to send someone after login.
export async function getOsActorOrNull(): Promise<OsActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const staff = await prisma.staffUser.findUnique({ where: { authId: user.id } });
  if (!staff || !staff.active) return null;

  const actor = toActor(staff);
  return can(actor, "os.access") ? actor : null;
}

/// Page-level guard. Throws rather than redirecting so the /os error boundary
/// can render a real explanation instead of bouncing someone to a login form
/// they're already past.
export async function requireCapability(capability: Capability): Promise<OsActor> {
  const actor = await getOsActor();
  if (!can(actor, capability)) {
    throw new OsAccessError(
      `Your role (${actor.role.replace("_", " ")}) doesn't include ${capability}.`
    );
  }
  return actor;
}

/// Action-level guard for anything that belongs to a sport. Prefer this over
/// requireCapability whenever a sport is knowable — it is the check that keeps
/// a Head of Basketball out of volleyball operations.
export function assertForSport(
  actor: OsActor,
  capability: Capability,
  sport: string | null | undefined
) {
  if (!canForSport(actor, capability, sport)) {
    throw new OsAccessError(
      sport
        ? `You don't have access to ${sport} operations.`
        : "You don't have access to that."
    );
  }
}

// ---------------------------------------------------------------------------
// Query scopes.
//
// These return Prisma `where` fragments so scoping happens IN the query. A
// filter applied after fetching is one forgotten `.filter()` from a leak, and
// it also can't be paginated correctly. Same technique as lib/coach-dal.ts,
// which this deliberately mirrors.
// ---------------------------------------------------------------------------

export function programScope(actor: OsActor): Prisma.ProgramWhereInput {
  const sports = scopedSports(actor);
  if (sports === null) return {};
  if (sports.length === 0) return {};
  return { sport: { in: sports } };
}

export function sessionScope(actor: OsActor): Prisma.SessionWhereInput {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  return { program: { sport: { in: sports } } };
}

export function registrationScope(actor: OsActor): Prisma.RegistrationWhereInput {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  return { program: { sport: { in: sports } } };
}

export function athleteScope(actor: OsActor): Prisma.AthleteWhereInput {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  // A head coach sees athletes who touch their sport — through a registration,
  // a booked session, or a team. Not the whole customer database.
  return {
    OR: [
      { registrations: { some: { program: { sport: { in: sports } } } } },
      { bookings: { some: { session: { program: { sport: { in: sports } } } } } },
      { teamMemberships: { some: { team: { program: { sport: { in: sports } } } } } },
    ],
  };
}

export function familyScope(actor: OsActor): Prisma.FamilyWhereInput {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  return { athletes: { some: athleteScope(actor) } };
}

export function teamScope(actor: OsActor): Prisma.TeamWhereInput {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  return { program: { sport: { in: sports } } };
}

// ---------------------------------------------------------------------------
// Record-level assertions. Each composes the scope filter with the requested
// id and asks the database. Out-of-scope and nonexistent return the SAME
// error, so a head coach can't probe for the existence of another sport's
// records by watching which id 404s and which 403s.
// ---------------------------------------------------------------------------

export async function assertProgramAccess(actor: OsActor, programId: string) {
  const found = await prisma.program.findFirst({
    where: { AND: [{ id: programId }, programScope(actor)] },
    select: { id: true, sport: true },
  });
  if (!found) throw new OsAccessError();
  return found;
}

export async function assertAthleteAccess(actor: OsActor, athleteId: string) {
  const found = await prisma.athlete.findFirst({
    where: { AND: [{ id: athleteId }, athleteScope(actor)] },
    select: { id: true, familyId: true },
  });
  if (!found) throw new OsAccessError();
  return found;
}

export async function assertFamilyAccess(actor: OsActor, familyId: string) {
  const found = await prisma.family.findFirst({
    where: { AND: [{ id: familyId }, familyScope(actor)] },
    select: { id: true },
  });
  if (!found) throw new OsAccessError();
  return found;
}

export async function assertRegistrationAccess(actor: OsActor, registrationId: string) {
  const found = await prisma.registration.findFirst({
    where: { AND: [{ id: registrationId }, registrationScope(actor)] },
    select: { id: true, programId: true, program: { select: { sport: true } } },
  });
  if (!found) throw new OsAccessError();
  return found;
}
