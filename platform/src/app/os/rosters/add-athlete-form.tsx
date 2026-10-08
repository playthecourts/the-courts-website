"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAthleteToSession, type AddAthleteState } from "./actions";
import { BTN, ErrorNote, SuccessNote } from "../_components/ui";
import { AthletePicker } from "./athlete-picker";

export type AthleteOption = { id: string; label: string };

// One per class card (and in the Schedule's class popup). A type-to-search
// picker rather than a native <select>: on the front desk iPad a select opens
// a scroll wheel with no search, so staff were scrolling the whole
// alphabetical list to find one kid.
export function AddAthleteForm({
  sessionId,
  athletes,
  onAdded,
  bare = false,
}: {
  sessionId: string;
  athletes: AthleteOption[];
  onAdded?: () => void;
  bare?: boolean;
}) {
  const [state, action, pending] = useActionState<AddAthleteState, FormData>(addAthleteToSession, null);

  // Fire once per successful add (state is a new object each submit), not on
  // every re-render the parent's refresh causes.
  const handled = useRef<AddAthleteState>(null);
  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      onAdded?.();
    }
  }, [state, onAdded]);

  return (
    <div className={bare ? "" : "border-t border-gray-mid px-4 py-3"}>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label htmlFor={`add-${sessionId}`} className="sr-only">Athlete to add</label>
        {/* Re-key after each successful add so the picker clears for the next kid. */}
        <AthletePicker key={state?.ok ?? "picker"} id={`add-${sessionId}`} name="athleteId" options={athletes} placeholder="Add athlete — type a first or last name…" />
        <button type="submit" disabled={pending} className={BTN.secondary}>
          {pending ? "Adding…" : "Add to Class"}
        </button>
      </form>
      {state?.error ? <div className="mt-2"><ErrorNote>{state.error}</ErrorNote></div> : null}
      {state?.ok ? <div className="mt-2"><SuccessNote>{state.ok}</SuccessNote></div> : null}
    </div>
  );
}
