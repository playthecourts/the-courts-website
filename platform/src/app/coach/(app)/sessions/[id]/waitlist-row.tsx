"use client";

import { useActionState } from "react";
import { offerWaitlistSpot } from "../actions";

// Moving a waitlisted athlete in can legitimately fail (the seat filled first,
// or this coach isn't authorized), so the button reports back instead of
// failing silently.
export default function WaitlistRow({
  sessionId,
  entryId,
  name,
  position,
  canManage,
}: {
  sessionId: string;
  entryId: string;
  name: string;
  position: number;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(async () => {
    return offerWaitlistSpot(sessionId, entryId);
  }, undefined as { ok: boolean; error?: string } | undefined);

  return (
    <div className="border-b border-gray-mid px-4 py-2.5 last:border-b-0">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="font-body text-sm text-near-black">
          {name}
          <span className="ml-2 font-sport text-xs text-gray-dark">#{position}</span>
        </span>
        {canManage ? (
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              className="min-h-[40px] rounded-lg border border-near-black px-3 font-sport text-[11px] font-bold uppercase tracking-wide text-near-black hover:bg-near-black hover:text-white disabled:opacity-50"
            >
              {pending ? "Moving…" : "Move In"}
            </button>
          </form>
        ) : (
          <span className="font-sport text-[10px] uppercase text-gray-dark">Waiting</span>
        )}
      </div>
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-1 font-body text-xs text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
