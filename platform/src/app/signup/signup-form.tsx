"use client";

import { useState, useActionState } from "react";
import { signup } from "@/app/actions/auth";

type AthleteRow = { key: number };

let nextKey = 1;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const [athletes, setAthletes] = useState<AthleteRow[]>([{ key: 0 }]);

  if (state && "success" in state && state.success) {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">{state.success}</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="athleteCount" value={athletes.length} />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Parent / Guardian
        </h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your Name
          <input
            type="text"
            name="name"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Phone <span className="font-normal text-neutral-400">Optional</span>
          <input
            type="tel"
            name="phone"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Family Name
          <input
            type="text"
            name="familyName"
            required
            placeholder="The Smith Family"
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Athletes
        </h2>
        {athletes.map((athlete, i) => (
          <div key={athlete.key} className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
            {athletes.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Athlete {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setAthletes((prev) => prev.filter((a) => a.key !== athlete.key))}
                  className="text-xs font-medium text-neutral-500 underline"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                First Name
                <input
                  type="text"
                  name={`athlete_${i}_firstName`}
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-base"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Last Name
                <input
                  type="text"
                  name={`athlete_${i}_lastName`}
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-base"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Date of Birth
              <input
                type="date"
                name={`athlete_${i}_dob`}
                required
                className="rounded-md border border-neutral-300 px-3 py-2 text-base"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Grade <span className="font-normal text-neutral-400">Optional</span>
                <input
                  type="text"
                  name={`athlete_${i}_grade`}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-base"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Gender <span className="font-normal text-neutral-400">Optional</span>
                <input
                  type="text"
                  name={`athlete_${i}_gender`}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-base"
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAthletes((prev) => [...prev, { key: nextKey++ }])}
          className="w-fit text-sm font-semibold text-orange-600 underline"
        >
          + Add another athlete
        </button>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}
