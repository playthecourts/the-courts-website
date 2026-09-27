"use client";

import { useState, useTransition } from "react";
import { archiveAthlete } from "../actions";

export function ArchiveAthleteButton({ athleteId, firstName }: { athleteId: string; firstName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          if (
            window.confirm(
              `Archive ${firstName}? This removes them from your account — nothing is deleted, and our staff can restore them if needed.`
            )
          ) {
            startTransition(async () => {
              const result = await archiveAthlete(athleteId);
              if (!result.ok) setError(result.error ?? "Something went wrong.");
            });
          }
        }}
        className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-gray-dark underline decoration-gray-mid underline-offset-2 hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? "Archiving…" : `Archive ${firstName}`}
      </button>
      {error && <p className="mt-1.5 font-body text-xs text-danger">{error}</p>}
    </div>
  );
}
