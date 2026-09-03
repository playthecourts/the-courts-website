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
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
