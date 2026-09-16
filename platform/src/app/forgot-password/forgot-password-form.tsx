"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state && "success" in state && state.success) {
    return (
      <p className="rounded-md border border-gray-mid bg-gray-light px-4 py-3 font-body text-sm text-black">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      {state && "error" in state && state.error && (
        <p className="font-body text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-orange px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Reset Link →"}
      </button>
    </form>
  );
}
