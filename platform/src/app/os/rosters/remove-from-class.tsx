"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rosterRemoveBooking } from "./actions";

// Two taps to take an athlete out of a class: "Remove", then "Confirm".
export function RemoveFromClass({ bookingId, name }: { bookingId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove() {
    setError(null);
    start(async () => {
      const res = await rosterRemoveBooking(bookingId);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`Confirm removing ${name} from this class`}
            className="os-heading inline-flex min-h-9 items-center rounded-full border border-danger bg-white px-3 text-xs uppercase tracking-wide text-danger disabled:opacity-60"
          >
            {pending ? "Removing…" : "Confirm"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-xs text-gray-dark underline">
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${name} from this class`}
          className="text-xs text-gray-dark underline underline-offset-2 hover:text-danger"
        >
          Remove
        </button>
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
