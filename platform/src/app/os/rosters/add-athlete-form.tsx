"use client";

import { useActionState } from "react";
import { addAthleteToSession, type AddAthleteState } from "./actions";
import { BTN, SELECT, ErrorNote, SuccessNote } from "../_components/ui";

export type AthleteOption = { id: string; label: string };

// One per class card. A plain <select> on purpose: the whole athlete list is
// under a hundred names and a native select is searchable by typing on every
// device the front desk uses.
export function AddAthleteForm({ sessionId, athletes }: { sessionId: string; athletes: AthleteOption[] }) {
  const [state, action, pending] = useActionState<AddAthleteState, FormData>(addAthleteToSession, null);

  return (
    <div className="border-t border-gray-mid px-4 py-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label htmlFor={`add-${sessionId}`} className="sr-only">Athlete to add</label>
        <select id={`add-${sessionId}`} name="athleteId" defaultValue="" required className={`${SELECT} min-w-56 flex-1 sm:flex-none`}>
          <option value="" disabled>Add an athlete…</option>
          {athletes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <button type="submit" disabled={pending} className={BTN.secondary}>
          {pending ? "Adding…" : "Add to Class"}
        </button>
      </form>
      {state?.error ? <div className="mt-2"><ErrorNote>{state.error}</ErrorNote></div> : null}
      {state?.ok ? <div className="mt-2"><SuccessNote>{state.ok}</SuccessNote></div> : null}
    </div>
  );
}
