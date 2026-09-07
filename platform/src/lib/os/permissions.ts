// ---------------------------------------------------------------------------
// Courts OS authorization model.
//
// One matrix, consulted everywhere. Two rules make this trustworthy:
//
//   1. Capabilities are checked on the SERVER, in the data layer, before a
//      query runs — not by hiding a button. `requireCapability` in os/dal.ts
//      is the enforcement point; this file only states the policy.
//
//   2. A head coach is scoped to their sport by DATA, not by role alone. Two
//      questions have to be answered for them — "may this role do X?" and
//      "does this record belong to their sport?" — and `canForSport` below
//      makes forgetting the second one hard, because the sport-sensitive
//      capabilities are listed explicitly in SPORT_SCOPED.
//
// This file is pure policy: no database, no request, no I/O. That makes it
// readable as a spec and testable on its own.
// ---------------------------------------------------------------------------

import type { StaffRole } from "@/generated/prisma/enums";

export const CAPABILITIES = [
  // Access
  "os.access",

  // People
  "families.view",
  "families.edit",
  "families.merge",
  /// Medical notes + emergency contacts. Separate from families.view on
  /// purpose: front desk needs to find a family, not read their medical notes.
  "families.viewSensitive",
  "athletes.view",
  "athletes.edit",
  /// The custody / contact-restriction free text. Separate from
  /// families.viewSensitive (medical + emergency) because it has a different
  /// and smaller audience: a head coach may need to know a child carries an
  /// EpiPen; nobody outside owner/admin/front desk needs the family's legal
  /// situation. Coaches get a one-line pickup instruction instead, written by
  /// staff, and never this.
  "athletes.viewCustody",
  /// Photo + video permission status only — three words, no release text and
  /// no guardian details. Held by marketing precisely so they can check before
  /// a shoot WITHOUT being given athlete records.
  "athletes.viewMediaStatus",

  // Leads / CRM
  "leads.view",
  "leads.manage",

  // Programming
  "programs.view",
  "programs.create",
  "programs.edit",
  "programs.publish",
  "programs.archive",

  // Schedule + facility
  "schedule.view",
  "schedule.edit",
  "facility.view",
  "facility.block",

  // Registrations
  "registrations.view",
  "registrations.create",
  "registrations.edit",
  "registrations.cancel",

  // Money
  "payments.view",
  "payments.sendLink",
  "payments.refund",
  "payments.promo",
  /// Business-level revenue reporting — deliberately distinct from
  /// payments.view, which is "did this family pay for this registration".
  "financials.view",

  // Training plans
  "plans.view",
  "plans.manage",
  "plans.adjustCredits",

  // Leagues
  "leagues.view",
  "leagues.manage",
  "evaluations.view",
  "evaluations.manage",
  "teams.manage",
  "teams.publish",

  // Staffing
  "coaches.view",
  "coaches.manage",
  "coverage.view",
  "coverage.assign",

  // Comms + content
  "communications.view",
  "communications.send",
  "content.manage",

  // Ops
  "reports.view",
  "tasks.view",
  "tasks.manage",
  "audit.view",
  "staff.manage",
  "export.data",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/// Capabilities whose answer also depends on WHICH sport the record belongs to.
/// A head coach holding one of these may only exercise it inside their sports.
/// Anything not listed here is sport-neutral (e.g. facility.block).
const SPORT_SCOPED = new Set<Capability>([
  "programs.create",
  "programs.edit",
  "programs.publish",
  "programs.archive",
  "schedule.edit",
  "registrations.create",
  "registrations.edit",
  "registrations.cancel",
  "leagues.manage",
  "evaluations.manage",
  "teams.manage",
  "teams.publish",
  "coaches.manage",
  "coverage.assign",
  "communications.send",
  "athletes.edit",
]);

const ALL: Capability[] = [...CAPABILITIES];

/// Operational access across the business. Financial *reporting* is left off
/// by default and granted per-user (see StaffUser overrides) — an admin can
/// always see whether a registration was paid; seeing company revenue is a
/// different question.
const ADMIN: Capability[] = ALL.filter((c) => c !== "staff.manage");

const HEAD_COACH: Capability[] = [
  "os.access",
  "families.view",
  "families.viewSensitive",
  "athletes.view",
  "athletes.edit",
  "athletes.viewMediaStatus",
  "programs.view",
  "programs.create",
  "programs.edit",
  "programs.publish",
  "programs.archive",
  "schedule.view",
  "schedule.edit",
  "facility.view",
  "registrations.view",
  "registrations.create",
  "registrations.edit",
  "registrations.cancel",
  // Can see whether a family paid — cannot move money.
  "payments.view",
  "plans.view",
  "leagues.view",
  "leagues.manage",
  "evaluations.view",
  "evaluations.manage",
  "teams.manage",
  "teams.publish",
  "coaches.view",
  "coaches.manage",
  "coverage.view",
  "coverage.assign",
  "communications.view",
  "communications.send",
  "reports.view",
  "tasks.view",
  "tasks.manage",
  "leads.view",
  "leads.manage",
  "export.data",
];

/// Coaches live in the Coach App. This is the sliver of Courts OS they can
/// reach if they land here — their own schedule and the athletes they coach.
const COACH: Capability[] = [
  "os.access",
  "athletes.view",
  "athletes.viewMediaStatus",
  "schedule.view",
  "coverage.view",
  "communications.view",
  "tasks.view",
];

const FRONT_DESK: Capability[] = [
  "os.access",
  "families.view",
  "families.edit",
  /// Front desk holds the safety half of the record deliberately. They are who
  /// a parent reaches at the door, who reads an allergy before a camp, and who
  /// refuses a pickup. Withholding emergency contacts and custody restrictions
  /// from the desk would make the desk unable to do the one job only it can do.
  "families.viewSensitive",
  "athletes.viewCustody",
  "athletes.viewMediaStatus",
  "athletes.view",
  "programs.view",
  "schedule.view",
  "facility.view",
  "registrations.view",
  "registrations.create",
  // "Did this family pay?" — yes. "Refund them" — no.
  "payments.view",
  "plans.view",
  "communications.view",
  "coverage.view",
  "tasks.view",
  "tasks.manage",
  "leads.view",
  "leads.manage",
];

/// Content only. No athlete records, no money — marketing does not need either,
/// and this system holds information about children.
const MARKETING: Capability[] = [
  "os.access",
  /// The ONLY athlete-adjacent thing marketing may see: whether a given athlete
  /// is Media OK / Ask First / No Media, for planning a shoot. No DOB, no
  /// medical data, no emergency contacts, no custody information, no pickup
  /// lists, no coach notes — and no athlete list of their own.
  "athletes.viewMediaStatus",
  "programs.view",
  "schedule.view",
  "content.manage",
  "communications.view",
  "tasks.view",
];

const FINANCE_VIEWER: Capability[] = [
  "os.access",
  "payments.view",
  "financials.view",
  "reports.view",
  "plans.view",
  "programs.view",
  "export.data",
];

const MATRIX: Record<StaffRole, Capability[]> = {
  owner: ALL,
  admin: ADMIN,
  head_coach: HEAD_COACH,
  coach: COACH,
  front_desk: FRONT_DESK,
  marketing: MARKETING,
  finance_viewer: FINANCE_VIEWER,
};

export type OsActor = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /// Sports a head coach is scoped to. Empty for every other role.
  sports: string[];
  active: boolean;
  /// Per-user grants layered on top of the role, for the cases the spec calls
  /// out as configurable ("Admin — financial permissions configurable").
  extraCapabilities?: Capability[];
};

export function capabilitiesFor(actor: OsActor): Set<Capability> {
  const base = MATRIX[actor.role] ?? [];
  return new Set<Capability>([...base, ...(actor.extraCapabilities ?? [])]);
}

/// Sport-neutral check: "does this role hold this capability at all?"
export function can(actor: OsActor, capability: Capability): boolean {
  if (!actor.active) return false;
  return capabilitiesFor(actor).has(capability);
}

/// Sport-aware check. Use this whenever the thing being acted on has a sport.
/// `sport` of null means the record isn't sport-specific (a facility block, a
/// whole-business announcement) — a head coach is allowed those only if the
/// capability isn't sport-scoped in the first place.
export function canForSport(
  actor: OsActor,
  capability: Capability,
  sport: string | null | undefined
): boolean {
  if (!can(actor, capability)) return false;
  if (!SPORT_SCOPED.has(capability)) return true;

  // Owner/admin are never sport-limited.
  if (actor.role === "owner" || actor.role === "admin") return true;

  if (actor.role === "head_coach") {
    if (!sport) return false;
    return actor.sports.includes(sport);
  }

  return true;
}

/// Sports this actor may act within. `null` means "all sports" (no filter).
export function scopedSports(actor: OsActor): string[] | null {
  if (actor.role === "owner" || actor.role === "admin") return null;
  if (actor.role === "head_coach") return actor.sports;
  return null;
}

/// True when the actor's view of the business should be narrowed to a sport.
export function isSportScoped(actor: OsActor): boolean {
  return actor.role === "head_coach" && actor.sports.length > 0;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  head_coach: "Head Coach",
  coach: "Coach",
  front_desk: "Front Desk",
  marketing: "Marketing",
  finance_viewer: "Finance",
};
