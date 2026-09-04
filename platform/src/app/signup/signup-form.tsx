"use client";

import { useState, useActionState } from "react";
import { signup } from "@/app/actions/auth";

type AthleteRow = { key: number };

let nextKey = 1;

const labelClass =
  "flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark";
const inputClass =
  "rounded-md border border-gray-mid px-3 py-2 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const [athletes, setAthletes] = useState<AthleteRow[]>([{ key: 0 }]);

  if (state && "success" in state && state.success) {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 font-body text-sm text-green-800">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="athleteCount" value={athletes.length} />

      <div className="flex flex-col gap-4">
        <h2 className="font-sport text-xs font-bold uppercase tracking-widest text-orange">
          Parent / Guardian
        </h2>
        <label className={labelClass}>
          Your Name
          <input type="text" name="name" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input type="email" name="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className={labelClass}>
          Password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Phone <span className="font-body font-normal normal-case tracking-normal text-gray-mid">Optional</span>
          <input type="tel" name="phone" className={inputClass} />
        </label>
        <label className={labelClass}>
          Family Name
          <input
            type="text"
            name="familyName"
            required
            placeholder="The Smith Family"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-sport text-xs font-bold uppercase tracking-widest text-orange">
          Athletes
        </h2>
        {athletes.map((athlete, i) => (
          <div key={athlete.key} className="flex flex-col gap-3 rounded-md border border-gray-mid p-4">
            {athletes.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                  Athlete {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setAthletes((prev) => prev.filter((a) => a.key !== athlete.key))}
                  className="font-body text-xs font-medium text-gray-dark underline"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                First Name
                <input type="text" name={`athlete_${i}_firstName`} required className={inputClass} />
              </label>
              <label className={labelClass}>
                Last Name
                <input type="text" name={`athlete_${i}_lastName`} required className={inputClass} />
              </label>
            </div>
            <label className={labelClass}>
              Date of Birth
              <input type="date" name={`athlete_${i}_dob`} required className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Grade
                <input type="text" name={`athlete_${i}_grade`} required className={inputClass} />
              </label>
              <label className={labelClass}>
                Gender
                <select name={`athlete_${i}_gender`} required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Select one
                  </option>
                  <option value="Boy">Boy</option>
                  <option value="Girl">Girl</option>
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2 font-body text-sm text-gray-dark">
              <input
                type="checkbox"
                name={`athlete_${i}_photoConsent`}
                required
                className="mt-0.5 h-4 w-4 rounded border-gray-mid text-orange focus:ring-orange"
              />
              I consent to photos/video of my athlete being used by The Courts.
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAthletes((prev) => [...prev, { key: nextKey++ }])}
          className="w-fit font-sport text-sm font-bold uppercase tracking-wide text-orange hover:text-orange-hover"
        >
          + Add Another Athlete
        </button>
      </div>

      {state?.error && (
        <p className="font-body text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-orange px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create Account →"}
      </button>
    </form>
  );
}
