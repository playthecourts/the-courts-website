"use client";

import { useTransition } from "react";
import { cancelLeagueRegistration } from "./actions";

export function CancelRegistrationButton({ athleteId }: { athleteId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Withdraw this registration? This can't be undone.")) {
          startTransition(() => cancelLeagueRegistration(athleteId));
        }
      }}
      className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark underline decoration-gray-mid underline-offset-2 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}
