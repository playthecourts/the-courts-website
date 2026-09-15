"use client";

import { useTransition } from "react";
import { startLeagueRegistration } from "./actions";

export function RegisterButton({
  athleteId,
  label = "Register →",
}: {
  athleteId: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => startLeagueRegistration(athleteId))}
      className="min-h-[38px] rounded-full bg-orange px-4 font-sport text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
    >
      {isPending ? "Redirecting…" : label}
    </button>
  );
}
