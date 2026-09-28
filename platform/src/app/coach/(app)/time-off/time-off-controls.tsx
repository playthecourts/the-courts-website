"use client";

import { useState, useTransition } from "react";
import { requestTimeOff, cancelTimeOff } from "./actions";

export function RequestTimeOffForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await requestTimeOff(formData);
          if (!result.ok) setError(result.error ?? "Something went wrong.");
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">From</span>
          <input type="date" name="startDate" required className="min-h-11 rounded-lg border border-gray-mid px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">Through</span>
          <input type="date" name="endDate" required className="min-h-11 rounded-lg border border-gray-mid px-2 text-sm" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">Note (optional)</span>
        <input name="note" placeholder="e.g. Family trip" className="min-h-11 rounded-lg border border-gray-mid px-3 text-sm" />
      </label>
      {error && <p className="font-body text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-lg bg-orange px-4 font-heading text-sm font-bold uppercase tracking-wide text-white hover:bg-orange-hover disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Request Time Off"}
      </button>
    </form>
  );
}

export function CancelTimeOffButton({ ids }: { ids: string[] }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Remove this time off?")) {
          startTransition(() => cancelTimeOff(ids));
        }
      }}
      className="shrink-0 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark underline decoration-gray-mid underline-offset-2 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? "Removing…" : "Remove"}
    </button>
  );
}
