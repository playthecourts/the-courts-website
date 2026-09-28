"use client";

import { useState, useEffect, useActionState } from "react";
import { coachSignup } from "@/app/actions/auth";

const SPORTS = ["Basketball", "Volleyball", "Multi-Sport", "General"] as const;

const labelClass = "flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark";
const inputClass =
  "min-h-[48px] rounded-lg border border-gray-mid bg-white px-3 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none";

export function CoachSignupForm() {
  const [state, formAction, pending] = useActionState(coachSignup, undefined);
  // Same bot-timing guard as the parent signup form — set on mount so it
  // reflects when the form was actually opened, not server render time.
  const [openedAt, setOpenedAt] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- must be a client-only timestamp
  useEffect(() => setOpenedAt(Date.now()), []);

  if (state && "success" in state && state.success) {
    return <p className="rounded-md bg-green-50 px-4 py-3 font-body text-sm text-green-800">{state.success}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="form_opened_at" value={openedAt} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Leave this field empty
          <input type="text" name="hp_field" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className={labelClass}>
        Full Name
        <input type="text" name="name" required autoComplete="name" className={inputClass} />
      </label>

      <label className={labelClass}>
        Email
        <input type="email" name="email" required autoComplete="email" className={inputClass} />
      </label>

      <label className={labelClass}>
        Phone (optional)
        <input type="tel" name="phone" autoComplete="tel" className={inputClass} />
      </label>

      <label className={labelClass}>
        Password
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>What do you coach?</legend>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <label
              key={sport}
              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-gray-mid bg-white px-3 has-[:checked]:border-orange has-[:checked]:bg-orange/5"
            >
              <input type="checkbox" name="sports" value={sport} className="accent-orange" />
              <span className="font-body text-sm normal-case tracking-normal text-near-black">{sport}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state && "error" in state && state.error && (
        <p className="font-body text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 min-h-[52px] rounded-lg bg-orange px-5 font-heading text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}
