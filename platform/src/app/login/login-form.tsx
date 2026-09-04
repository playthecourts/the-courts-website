"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/my-courts";
  const [state, formAction, pending] = useActionState(login, undefined);

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
          className="rounded-md border border-gray-mid px-3 py-2 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-gray-mid px-3 py-2 font-body text-base font-normal normal-case tracking-normal text-black focus:border-orange focus:outline-none"
        />
      </label>

      {state?.error && (
        <p className="font-body text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-orange px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign In →"}
      </button>
    </form>
  );
}
