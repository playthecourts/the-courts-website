"use client";

import { useState, useTransition } from "react";
import { retryMembershipSetup } from "./actions";

export function FinishMembershipSetupButton({ registrationId }: { registrationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await retryMembershipSetup(registrationId);
            if (!result.ok) setError(result.error ?? "Still couldn't set it up — we've been notified.");
          })
        }
        className="min-h-[38px] w-fit rounded-full bg-orange px-4 font-sport text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {isPending ? "Setting Up…" : "Finish Setting Up Membership →"}
      </button>
      {error && <p className="font-body text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
