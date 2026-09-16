"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
        New Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? "Saving…" : "Set New Password →"}
      </button>
    </form>
  );
}
