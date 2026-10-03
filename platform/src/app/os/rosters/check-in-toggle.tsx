"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rosterSetCheckIn } from "./actions";

// One tap to check an athlete in from Class Rosters; tap again to undo.
// Optimistic, then the page refreshes so counts and the Front Desk agree.
export function CheckInToggle({ bookingId, here }: { bookingId: string; here: boolean }) {
  const router = useRouter();
  const [override, setOverride] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const on = override ?? here;

  function toggle() {
    const next = !on;
    setOverride(next);
    setError(null);
    start(async () => {
      const res = await rosterSetCheckIn(bookingId, next);
      if (!res.ok) setError(res.error);
      router.refresh();
      setOverride(null);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`os-heading inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs uppercase tracking-wide transition-colors disabled:opacity-60 ${
          on ? "border-success bg-success-bg text-success" : "border-gray-mid bg-white text-near-black hover:border-near-black"
        }`}
      >
        <span aria-hidden="true">{on ? "✓" : "○"}</span>
        {on ? "Checked In" : "Check In"}
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
