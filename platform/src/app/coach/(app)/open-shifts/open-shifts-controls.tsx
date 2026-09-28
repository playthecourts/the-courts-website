"use client";

import { useState, useTransition } from "react";
import { claimOpenShift } from "./actions";

export function ClaimShiftButton({ sessionId }: { sessionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await claimOpenShift(sessionId);
            if (!result.ok) setError(result.error ?? "Something went wrong.");
          });
        }}
        className="min-h-[40px] rounded-lg bg-orange px-4 font-heading text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-hover disabled:opacity-50"
      >
        {isPending ? "Claiming…" : "Claim"}
      </button>
      {error && <p className="mt-1 max-w-[140px] font-body text-[11px] text-danger">{error}</p>}
    </div>
  );
}
