"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";

// Reuses the existing login server action rather than adding a second auth
// path — only the post-login destination differs.
const ERRORS: Record<string, string> = {
  "not-staff": "That account isn't a Courts staff account. Coaches are set up by an admin.",
  inactive: "This coach account is inactive. Contact a Courts admin.",
  "no-coach-access": "That account doesn't have Coach App access.",
};

export function CoachLoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/coach";
  const errorCode = searchParams.get("error");
  const [state, formAction, pending] = useActionState(login, undefined);

  const message = state?.error ?? (errorCode ? ERRORS[errorCode] : null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="min-h-[48px] rounded-lg border border-gray-mid bg-white px-3 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="min-h-[48px] rounded-lg border border-gray-mid bg-white px-3 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none"
        />
      </label>

      {message && (
        <p className="font-body text-sm text-red-700" role="alert">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 min-h-[52px] rounded-lg bg-orange px-5 font-heading text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
