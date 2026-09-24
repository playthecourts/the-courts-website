"use client";

import { useState, useTransition } from "react";
import { submitWinterLeagueInterest } from "./actions";

export function WinterLeagueInterestForm({ athleteId }: { athleteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p className="mt-3 rounded-lg border border-orange bg-white px-4 py-3 font-body text-sm text-black">
        You&rsquo;re on the list — we&rsquo;ll reach out with Winter League details.
      </p>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await submitWinterLeagueInterest(athleteId, formData);
          setSubmitted(true);
        })
      }
      className="mt-3 flex flex-col gap-2"
    >
      <textarea
        name="note"
        rows={2}
        placeholder="Anything we should know? (optional)"
        className="w-full rounded-lg border border-gray-mid px-3 py-2 font-body text-sm text-near-black placeholder:text-gray-dark/60"
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-fit items-center justify-center rounded-full bg-orange px-5 py-2.5 font-sport text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
      >
        {isPending ? "Submitting…" : "Raise Your Hand for Winter"}
      </button>
    </form>
  );
}
