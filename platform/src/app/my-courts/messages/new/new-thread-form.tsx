"use client";

import { useActionState } from "react";
import { startThread } from "../actions";

export function NewThreadForm({
  athletes,
  defaultSubject,
}: {
  athletes: { id: string; firstName: string }[];
  defaultSubject: string;
}) {
  const [state, action, pending] = useActionState(startThread, null as { error?: string } | null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="subject" className="mb-1.5 block font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
          What&rsquo;s it about
        </label>
        <input
          id="subject"
          name="subject"
          required
          defaultValue={defaultSubject}
          placeholder="Missed session, schedule question…"
          className="min-h-11 w-full rounded-lg border border-gray-mid bg-white px-3 font-body text-sm focus:border-orange focus:outline-none"
        />
      </div>

      {athletes.length > 0 ? (
        <div>
          <label htmlFor="athleteId" className="mb-1.5 block font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
            Which athlete <span className="font-normal normal-case tracking-normal text-gray-dark">(optional)</span>
          </label>
          <select
            id="athleteId"
            name="athleteId"
            defaultValue=""
            className="min-h-11 w-full rounded-lg border border-gray-mid bg-white px-3 font-body text-sm focus:border-orange focus:outline-none"
          >
            <option value="">Not about one athlete</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="body" className="mb-1.5 block font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          className="w-full rounded-lg border border-gray-mid bg-white px-3 py-2 font-body text-sm focus:border-orange focus:outline-none"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="font-body text-sm text-red-700">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-orange px-5 font-sport text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send to The Courts"}
      </button>
    </form>
  );
}
