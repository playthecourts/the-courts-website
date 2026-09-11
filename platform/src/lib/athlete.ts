// The athlete vocabulary — the small, opinionated lists that make a profile
// feel like a profile rather than a form, plus the derivations that keep
// sensitive source data off the screen.
//
// These live in code, not the database, for the same reason coach-tags.ts does:
// they are short, they will be tuned, and tuning them should not need a
// migration.

export type CompetitiveMeterKey = "here_to_learn" | "likes_a_challenge" | "keep_score";

/// Multi-select. Phrased in the athlete's voice because the parent is answering
/// on their kid's behalf and "Show me first" reads truer than "Visual learner".
export const COACHING_PREFERENCES: { key: string; label: string }[] = [
  { key: "show_me_first", label: "Show me first" },
  { key: "tell_me_what_to_fix", label: "Tell me what to fix" },
  { key: "challenge_me", label: "Challenge me" },
  { key: "lots_of_reps", label: "Lots of reps" },
  { key: "encourage_me", label: "Encourage me" },
];

export const COMPETITIVE_METER: { key: CompetitiveMeterKey; label: string }[] = [
  { key: "here_to_learn", label: "Here to learn" },
  { key: "likes_a_challenge", label: "Likes a challenge" },
  { key: "keep_score", label: "Please keep score 😂" },
];

export const OTHER_SPORTS = [
  "Soccer",
  "Baseball",
  "Softball",
  "Football",
  "Tennis",
  "Dance",
  "Cheer",
];

export const SPORT_CHOICES = ["Basketball", "Volleyball"] as const;

export function coachingPreferenceLabels(keys: string[]): string[] {
  return keys
    .map((k) => COACHING_PREFERENCES.find((p) => p.key === k)?.label)
    .filter((l): l is string => Boolean(l));
}

export function competitiveMeterLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return COMPETITIVE_METER.find((c) => c.key === key)?.label ?? null;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

type NameParts = { firstName: string; lastName: string; nickname?: string | null };

/// What we call them. Everywhere.
export function displayName(a: NameParts): string {
  return a.nickname?.trim() || a.firstName;
}

/// Full name, for the places that genuinely need the legal-ish version —
/// rosters, the front desk, admin. Never used in marketing copy.
export function fullName(a: NameParts): string {
  return `${a.firstName} ${a.lastName}`.trim();
}

/// Two letters for the fallback avatar. Deliberately initials on brand colour
/// rather than a grey silhouette — a child with no photo yet should still look
/// like a member, not like missing data.
export function initials(a: NameParts): string {
  const first = (a.nickname?.trim() || a.firstName || "").charAt(0);
  const last = (a.lastName || "").charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

// ---------------------------------------------------------------------------
// Date of birth
//
// DOB is collected once and then deliberately hidden. Age is derived where it
// is operationally needed (eligibility, grouping); the birthday MONTH is the
// only part that ever appears on a Player Card, and it is derived too — parents
// are never asked to type a birthday month they already gave us.
// ---------------------------------------------------------------------------

/// UTC throughout, matching the platform-wide convention in coach-format.ts.
/// A date-only column read in local time can slip a day and change someone's
/// birthday month, which is exactly the kind of small wrongness parents notice.
export function birthdayMonth(dob: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(dob);
}

export function ageFrom(dob: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Profile completeness
//
// Drives the quiet "Finish [name]'s profile" nudge. Note what is NOT counted:
// nothing here is required to book, and an incomplete profile never blocks
// participation. It is a prompt, not a gate.
// ---------------------------------------------------------------------------

export type CompletenessInput = {
  photoPath: string | null;
  goal: string | null;
  coachingPreferences: string[];
  competitiveMeter: string | null;
  emergencyContactCount: number;
};

export type CompletenessStep = { key: string; label: string; done: boolean; href: string };

export function completeness(a: CompletenessInput, athleteId: string): {
  steps: CompletenessStep[];
  done: number;
  total: number;
  nextStep: CompletenessStep | null;
} {
  const base = `/my-courts/athletes/${athleteId}`;
  const steps: CompletenessStep[] = [
    { key: "photo", label: "Add a photo", done: Boolean(a.photoPath), href: `${base}/edit/photo` },
    { key: "about", label: "What they're working on", done: Boolean(a.goal), href: `${base}/edit/about` },
    {
      key: "coaching",
      label: "How they like to be coached",
      done: a.coachingPreferences.length > 0,
      href: `${base}/edit/coaching`,
    },
    {
      key: "emergency",
      label: "Emergency contact",
      done: a.emergencyContactCount > 0,
      href: `${base}/edit/safety`,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, nextStep: steps.find((s) => !s.done) ?? null };
}
