"use client";

import { useTransition } from "react";
import { cancelLeagueRegistration } from "./actions";

export function CancelRegistrationButton({ athleteId }: { athleteId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => cancelLeagueRegistration(athleteId))}
      className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark hover:text-red-600 disabled:opacity-50"
      title="No refunds"
    >
      {isPending ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}
