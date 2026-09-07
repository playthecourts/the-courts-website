import { setPickupInstruction } from "../actions";
import { INPUT, BTN } from "../../_components/ui";

// Server component with a plain form action — no client JS for a single field.

export default function PickupInstructionForm({
  athleteId,
  current,
}: {
  athleteId: string;
  current: string | null;
}) {
  return (
    <form action={setPickupInstruction.bind(null, athleteId)} className="px-4 py-3">
      <label
        htmlFor="instruction"
        className="mb-1.5 block font-sport text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-dark"
      >
        Instruction coaches see
      </label>
      <p className="mb-2 font-body text-[12.5px] leading-snug text-gray-dark">
        The minimum a coach needs to act on. No names, no legal detail — they never see the
        restriction itself.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="instruction"
          name="instruction"
          defaultValue={current ?? ""}
          placeholder="Do not release athlete to an unauthorized adult."
          className={INPUT}
        />
        <button type="submit" className={`${BTN.secondary} shrink-0`}>
          Save
        </button>
      </div>
    </form>
  );
}
