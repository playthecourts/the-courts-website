// Not in actions.ts: a "use server" file may only export async server
// actions, and this is a plain constant shared by the client-side
// cancellation form and the server action that validates against it.
export const CANCELLATION_REASONS = [
  "Schedule no longer works",
  "Athlete taking a break",
  "Another sport taking priority",
  "Cost",
  "Moving away",
  "Not using the membership enough",
  "Didn't meet expectations",
  "Other",
] as const;
