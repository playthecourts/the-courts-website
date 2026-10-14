/// The NextGen legacy-rate checkout is open only to families staff approved
/// in Courts OS → NextGen Transfers ("Approve at $165/$185", or "Set legacy
/// rate"). A self-reported "current NextGen" answer at signup no longer
/// unlocks it: as of Oct 14, 2026 everyone else buys standard plans
/// (Unlimited at $200).
export function canUseNextGenLegacyCheckout(g: {
  nextGenStatus: string | null;
  nextGenVerification: string | null;
  legacyRateCents: number | null;
}) {
  return g.nextGenStatus === "current_nextgen" && g.nextGenVerification === "admin_approved" && g.legacyRateCents != null;
}
