import { grantDropInCredits } from "../actions";
import { INPUT, BTN } from "../../_components/ui";

// Server component with a plain form action — no client JS needed. Every
// grant is its own Credit row (see the action), so this form only ever adds,
// never edits an existing balance.

export default function DropInCreditsForm({ athleteId }: { athleteId: string }) {
  return (
    <form action={grantDropInCredits.bind(null, athleteId)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1.5 block font-sport text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-dark">
          Grant credits
        </span>
        <input
          type="number"
          name="quantity"
          min={1}
          max={100}
          step={1}
          required
          placeholder="6"
          className={INPUT}
        />
      </label>
      <label className="flex-[2]">
        <span className="mb-1.5 block font-sport text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-dark">
          Note (optional)
        </span>
        <input type="text" name="note" placeholder="Why — shows in the ledger" className={INPUT} />
      </label>
      <button type="submit" className={`${BTN.primary} shrink-0`}>
        Grant →
      </button>
    </form>
  );
}
