// ---------------------------------------------------------------------------
// The Courts program-type registry.
//
// One table that answers, for every kind of thing The Courts runs: what do we
// call it, what does the builder ask for, and what does it default to.
//
// This is what makes the builder show League settings to somebody creating a
// league and NOT to somebody creating a Guided Dr. Dish session. The alternative
// — a 40-field form with most fields irrelevant — is how programs end up
// half-configured and how a camp gets published with a league's registration
// rules.
//
// These are DEFAULTS AND DISCLOSURE, not hard limits. Every field group can be
// revealed manually, and every default overridden; the registry decides what is
// shown first, not what is possible.
// ---------------------------------------------------------------------------

import type { ProgramType } from "@/generated/prisma/enums";
import type { CreditRule, PricingModel, RegistrationMode, ScheduleKind } from "@/generated/prisma/enums";

/// Field groups the builder can show. Each maps to a section of the form.
export type FieldGroup =
  | "basics"
  | "schedule"
  | "resource"
  | "staffing"
  | "eligibility"
  | "skill_level"
  | "capacity"
  | "waitlist"
  | "registration"
  | "pricing"
  | "training_plan"
  | "league"
  | "camp"
  | "event"
  | "forms"
  | "copy"
  | "publishing";

export type ProgramTypeDef = {
  type: ProgramType;
  /// What The Courts calls it. Never a generic SaaS label.
  label: string;
  /// One line in the "What are we making?" picker.
  tagline: string;
  /// Coach-led instruction vs. recreation/participation. The Courts sells these
  /// as genuinely different products and the distinction must not blur just
  /// because both are "programs" in the database.
  category: "training" | "recreation";
  /// Shown, in order, by the builder.
  groups: FieldGroup[];
  defaults: {
    scheduleKind: ScheduleKind;
    registrationMode: RegistrationMode;
    pricingModel: PricingModel;
    creditRule: CreditRule;
    capacity: number | null;
    durationMinutes: number | null;
    /// Blocks publish when no coach or staff member is assigned, unless an
    /// admin explicitly overrides.
    requiresCoach: boolean;
    /// Must reserve a resource of this type before publishing.
    requiredResourceType: string | null;
    /// Whether athlete eligibility (grade/age) is meaningful at all. A court
    /// rental has no athletes to be eligible.
    hasEligibility: boolean;
    lowSpotThreshold: number;
  };
  /// Deprecated legacy enum values that mean this type.
  legacyAliases?: ProgramType[];
};

export const PROGRAM_TYPES: ProgramTypeDef[] = [
  {
    type: "group_training",
    label: "Group Training",
    tagline: "Recurring coach-led skill work by grade band.",
    category: "training",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "skill_level", "capacity", "waitlist", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "recurring",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "uses_credit",
      capacity: 8,
      durationMinutes: 60,
      requiresCoach: true,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 3,
    },
    legacyAliases: ["class"],
  },
  {
    type: "private_training",
    label: "Private Training",
    tagline: "One athlete, or a small configured group, with a coach.",
    category: "training",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "capacity", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "member_price",
      capacity: 1,
      durationMinutes: 60,
      requiresCoach: true,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 1,
    },
    legacyAliases: ["private"],
  },
  {
    type: "skills_clinic",
    label: "Skills Clinic",
    tagline: "A focused one-off session on a single skill.",
    category: "training",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "skill_level", "capacity", "waitlist", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "offering",
      pricingModel: "one_time",
      creditRule: "member_price",
      capacity: 20,
      durationMinutes: 90,
      requiresCoach: true,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 3,
    },
  },
  {
    type: "camp",
    label: "Camp",
    tagline: "Multi-day programming, full camp or single days.",
    category: "training",
    groups: ["basics", "schedule", "camp", "resource", "staffing", "eligibility", "capacity", "waitlist", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "multi_day",
      registrationMode: "multi_day",
      pricingModel: "multi_day_package",
      creditRule: "member_price",
      capacity: 40,
      durationMinutes: 240,
      requiresCoach: true,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 5,
    },
  },
  {
    type: "league",
    label: "League",
    tagline: "A season: evaluations, teams, practices and games.",
    category: "recreation",
    groups: ["basics", "schedule", "league", "resource", "staffing", "eligibility", "capacity", "waitlist", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "season",
      registrationMode: "season",
      pricingModel: "one_time",
      creditRule: "separate_payment",
      capacity: null,
      durationMinutes: 60,
      requiresCoach: false,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 5,
    },
  },
  {
    type: "evaluation",
    label: "League Evaluation",
    tagline: "Assessment sessions that feed team placement.",
    category: "training",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "capacity", "waitlist", "registration", "pricing", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "session",
      pricingModel: "one_time",
      creditRule: "separate_payment",
      capacity: 40,
      durationMinutes: 90,
      requiresCoach: true,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 5,
    },
  },
  {
    type: "guided_dr_dish",
    label: "Guided Dr. Dish Session",
    tagline: "Coach-led shooting work on the Dr. Dish machine.",
    category: "training",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "capacity", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "recurring",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "member_price",
      capacity: 1,
      durationMinutes: 30,
      requiresCoach: true,
      requiredResourceType: "shooting_machine",
      hasEligibility: true,
      lowSpotThreshold: 1,
    },
    legacyAliases: ["resource"],
  },
  {
    type: "self_serve_dr_dish",
    label: "Self-Service Dr. Dish",
    tagline: "Independent machine time. No coach.",
    category: "recreation",
    groups: ["basics", "schedule", "resource", "capacity", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "recurring",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "separate_payment",
      capacity: 1,
      durationMinutes: 30,
      requiresCoach: false,
      requiredResourceType: "shooting_machine",
      hasEligibility: false,
      lowSpotThreshold: 1,
    },
  },
  {
    type: "open_gym",
    label: "Open Gym",
    tagline: "Facility access. Supervised, not coached.",
    category: "recreation",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "capacity", "registration", "pricing", "training_plan", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "recurring",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "separate_payment",
      capacity: 30,
      durationMinutes: 120,
      requiresCoach: false,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 5,
    },
  },
  {
    type: "court_rental",
    label: "Court Rental",
    tagline: "Someone books the court. No athletes, no eligibility.",
    category: "recreation",
    groups: ["basics", "schedule", "resource", "capacity", "registration", "pricing", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "session",
      pricingModel: "per_session",
      creditRule: "separate_payment",
      capacity: 1,
      durationMinutes: 60,
      requiresCoach: false,
      requiredResourceType: null,
      hasEligibility: false,
      lowSpotThreshold: 1,
    },
    legacyAliases: ["rental"],
  },
  {
    type: "party",
    label: "Party",
    tagline: "Birthday parties and private group bookings.",
    category: "recreation",
    groups: ["basics", "schedule", "resource", "staffing", "capacity", "registration", "pricing", "event", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "offering",
      pricingModel: "one_time",
      creditRule: "separate_payment",
      capacity: 20,
      durationMinutes: 120,
      requiresCoach: false,
      requiredResourceType: null,
      hasEligibility: false,
      lowSpotThreshold: 3,
    },
  },
  {
    type: "special_event",
    label: "Special Event",
    tagline: "Volleyween, Friday Night Hoops, Parents' Night Out.",
    category: "recreation",
    groups: ["basics", "schedule", "resource", "staffing", "eligibility", "capacity", "waitlist", "registration", "pricing", "event", "forms", "copy", "publishing"],
    defaults: {
      scheduleKind: "one_time",
      registrationMode: "offering",
      pricingModel: "one_time",
      creditRule: "separate_payment",
      capacity: 30,
      durationMinutes: 120,
      requiresCoach: false,
      requiredResourceType: null,
      hasEligibility: true,
      lowSpotThreshold: 3,
    },
    legacyAliases: ["event"],
  },
];

/// Legacy enum values, mapped to the canonical type they became. Kept so a row
/// written before the vocabulary migration still renders correctly.
const LEGACY_MAP: Partial<Record<ProgramType, ProgramType>> = Object.fromEntries(
  PROGRAM_TYPES.flatMap((d) => (d.legacyAliases ?? []).map((alias) => [alias, d.type]))
) as Partial<Record<ProgramType, ProgramType>>;

export function canonicalType(type: ProgramType): ProgramType {
  return LEGACY_MAP[type] ?? type;
}

const BY_TYPE = new Map<ProgramType, ProgramTypeDef>(PROGRAM_TYPES.map((d) => [d.type, d]));

export function programTypeDef(type: ProgramType): ProgramTypeDef {
  const def = BY_TYPE.get(canonicalType(type));
  // Every value in the enum is either canonical or aliased, so this is
  // unreachable — but returning a safe default beats crashing a page over a
  // program type somebody added to the enum without updating the registry.
  return def ?? BY_TYPE.get("special_event")!;
}

export function showsGroup(type: ProgramType, group: FieldGroup): boolean {
  return programTypeDef(type).groups.includes(group);
}

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = Object.fromEntries(
  (["class", "resource", "private", "rental", "event"] as ProgramType[])
    .map((legacy) => [legacy, programTypeDef(legacy).label])
    .concat(PROGRAM_TYPES.map((d) => [d.type, d.label]))
) as Record<ProgramType, string>;

/// The picker order in "What are we making?" — training products first, because
/// that is the bulk of what gets created, then facility/recreation.
export const CREATE_PICKER_ORDER: ProgramType[] = [
  "group_training",
  "private_training",
  "skills_clinic",
  "camp",
  "league",
  "evaluation",
  "guided_dr_dish",
  "self_serve_dr_dish",
  "open_gym",
  "court_rental",
  "party",
  "special_event",
];

export const SPORTS = ["Basketball", "Volleyball", "Multi-Sport", "General"] as const;
export type Sport = (typeof SPORTS)[number];

export const SKILL_LEVEL_LABELS = {
  beginner: "Beginner",
  developing: "Developing",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all_levels: "All Levels",
  invite_only: "Invite Only",
} as const;

export const OFFERING_STATUS_LABELS = {
  draft: "Draft",
  ready_to_publish: "Ready to Publish",
  published: "Published",
  registration_closed: "Registration Closed",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
} as const;

/// Grades as The Courts talks about them. Stored as integers so ranges compare
/// cleanly; K is 0 because "K-2nd" has to sort before "3rd-5th".
export const GRADES = [
  { value: 0, label: "K" },
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: 6, label: "6th" },
  { value: 7, label: "7th" },
  { value: 8, label: "8th" },
  { value: 9, label: "9th" },
  { value: 10, label: "10th" },
  { value: 11, label: "11th" },
  { value: 12, label: "12th" },
] as const;

export function gradeLabel(value: number): string {
  return GRADES.find((g) => g.value === value)?.label ?? String(value);
}

/// "3rd–5th Grade", "K–2nd Grade", "6th Grade" — the phrasing used on every
/// parent-facing surface, generated once here so it can't drift between them.
export function gradeRangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max ? `${gradeLabel(min)} Grade` : `${gradeLabel(min)}–${gradeLabel(max)} Grade`;
  }
  if (min !== null) return `${gradeLabel(min)} Grade and up`;
  return `Through ${gradeLabel(max!)} Grade`;
}
