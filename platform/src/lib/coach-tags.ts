// Quick tags for coach notes, and the evaluation rubrics.
//
// Both live in code rather than the database on purpose: they're small,
// sport-specific vocabularies that a head coach will want to adjust, and
// keeping them here means changing one doesn't need a migration. Evaluation
// scores are stored as Json keyed by the `key` values below.

export const NOTE_TAGS: Record<string, string[]> = {
  Basketball: [
    "Ball Handling",
    "Finishing",
    "Shooting",
    "Footwork",
    "Defense",
    "Passing",
    "Decision Making",
    "Confidence",
    "Effort",
  ],
  Volleyball: [
    "Serving",
    "Passing",
    "Setting",
    "Hitting",
    "Footwork",
    "Defense",
    "Communication",
    "Confidence",
    "Effort",
  ],
};

/** Tags shown when the sport is unknown or a program has no sport set. */
export const GENERIC_TAGS = ["Footwork", "Communication", "Confidence", "Effort", "Focus"];

export function tagsForSport(sport: string | null | undefined): string[] {
  if (!sport) return GENERIC_TAGS;
  return NOTE_TAGS[sport] ?? GENERIC_TAGS;
}

export type RubricCategory = { key: string; label: string };

/**
 * Six categories, 1–5 each. Deliberately short — a scouting combine is the
 * wrong tool for placing a 4th grader, and a long rubric just goes unfilled.
 * Volleyball gets its own vocabulary rather than basketball terms reused.
 */
export const EVALUATION_RUBRICS: Record<string, RubricCategory[]> = {
  Basketball: [
    { key: "ball_handling", label: "Ball Handling" },
    { key: "shooting", label: "Shooting" },
    { key: "finishing", label: "Finishing" },
    { key: "defense", label: "Defense / Movement" },
    { key: "awareness", label: "Game Awareness" },
    { key: "effort", label: "Competitiveness / Effort" },
  ],
  Volleyball: [
    { key: "serving", label: "Serving" },
    { key: "passing", label: "Passing" },
    { key: "setting", label: "Setting" },
    { key: "hitting", label: "Hitting" },
    { key: "movement", label: "Movement" },
    { key: "awareness", label: "Game Awareness" },
    { key: "communication", label: "Communication / Effort" },
  ],
};

export function rubricForSport(sport: string | null | undefined): RubricCategory[] {
  if (!sport) return EVALUATION_RUBRICS.Basketball;
  return EVALUATION_RUBRICS[sport] ?? EVALUATION_RUBRICS.Basketball;
}

/** Suggested placement levels offered after scoring. Advisory, not binding. */
export const RECOMMENDED_LEVELS = ["Developmental", "Competitive", "Advanced"];

/** Message templates. Coaches edit before sending; nothing auto-sends. */
export const MESSAGE_TEMPLATES: { name: string; subject: string; body: string }[] = [
  {
    name: "Practice Reminder",
    subject: "Practice reminder",
    body: "Quick reminder that we have practice coming up. Please arrive 10 minutes early so we can start on time.",
  },
  {
    name: "Schedule Change",
    subject: "Schedule change",
    body: "Please note a change to our upcoming schedule. The new time and location are below. Reply if you have a conflict.",
  },
  {
    name: "Running Late",
    subject: "Running a few minutes behind",
    body: "We're running a few minutes behind schedule today. We'll get started as soon as the court is clear.",
  },
  {
    name: "Game Reminder",
    subject: "Game reminder",
    body: "Reminder about our upcoming game. Please arrive 20 minutes before tip-off in team colors.",
  },
  {
    name: "What to Bring",
    subject: "What to bring",
    body: "For our next session, please bring a water bottle, court shoes, and a light and dark shirt.",
  },
  {
    name: "Camp Reminder",
    subject: "Camp reminder",
    body: "Camp starts soon. Please bring a water bottle, lunch, and court shoes. Doors open 15 minutes before the start time.",
  },
  {
    name: "Evaluation Reminder",
    subject: "Evaluation reminder",
    body: "A reminder that evaluations are coming up. Please arrive 15 minutes early to check in and warm up.",
  },
  {
    name: "Great Session Today",
    subject: "Great session today",
    body: "Great work from the group today. We covered a lot and the effort was excellent. See you next session.",
  },
];
