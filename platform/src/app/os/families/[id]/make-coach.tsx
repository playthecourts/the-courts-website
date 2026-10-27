"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { makeGuardianCoach } from "./actions";

// Two taps: "Make Coach" → "Confirm". Same login, adds the staff side.
export function MakeCoach({ guardianId }: { guardianId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const res = await makeGuardianCoach(guardianId);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-1">
      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <button type="button" onClick={confirm} disabled={pending} className="os-eyebrow rounded-full border border-orange px-3 py-1 text-orange disabled:opacity-60">
            {pending ? "Saving…" : "Confirm — same login"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-xs text-gray-dark underline">
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="os-eyebrow text-orange underline underline-offset-2">
          Make Coach
        </button>
      )}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
