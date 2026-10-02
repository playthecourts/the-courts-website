"use client";

import { useActionState } from "react";
import Link from "next/link";
import { exitKioskMode, type ExitState } from "../actions";

export default function KioskExitPage() {
  const [state, action, pending] = useActionState<ExitState, FormData>(exitKioskMode, null);

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <form action={action} className="w-full max-w-md rounded-2xl bg-white p-6 text-near-black">
        <h1 className="font-display text-[26px] font-black uppercase tracking-tight">Exit Kiosk Mode</h1>
        <p className="mt-1 mb-5 font-body text-[15px] text-gray-dark">Staff only. Enter the password for the account this iPad is signed in with.</p>
        <label htmlFor="password" className="sr-only">Staff password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-[52px] w-full rounded-lg border border-gray-mid px-4 font-body text-[17px]"
        />
        {state?.error ? <p className="mt-2 font-body text-[14px] text-danger">{state.error}</p> : null}
        <div className="mt-5 flex gap-3">
          <Link href="/kiosk" className="flex min-h-[52px] flex-1 items-center justify-center rounded-lg border border-gray-mid font-sport text-[14px] font-bold uppercase">
            Cancel
          </Link>
          <button type="submit" disabled={pending} className="min-h-[52px] flex-1 rounded-lg bg-orange font-sport text-[14px] font-bold uppercase text-white disabled:opacity-60">
            {pending ? "Checking…" : "Exit"}
          </button>
        </div>
      </form>
    </div>
  );
}
