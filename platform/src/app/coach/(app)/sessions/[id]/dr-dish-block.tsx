import { saveDrDishLog } from "../actions";
import { SectionHeading } from "@/components/coach/ui";

// Guided Dr. Dish.
//
// Every number here is typed in by the coach. There is NO Dr. Dish API or
// integration in this platform — the shooting percentage below is computed
// from the makes/attempts a human entered, and nothing is machine-reported.
// If a real integration is added later it should fill these same fields.
export default function DrDishBlock({
  sessionId,
  athletes,
  logs,
}: {
  sessionId: string;
  athletes: { id: string; name: string }[];
  logs: {
    athleteId: string;
    workout: string | null;
    makes: number | null;
    attempts: number | null;
    focus: string | null;
  }[];
}) {
  const byAthlete = new Map(logs.map((l) => [l.athleteId, l]));

  return (
    <div>
      <SectionHeading>Guided Dr. Dish</SectionHeading>
      <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
        {athletes.length === 0 && (
          <p className="px-4 py-4 font-body text-sm text-gray-dark">Nobody booked on the machine.</p>
        )}
        {athletes.map((a) => {
          const log = byAthlete.get(a.id);
          const pct =
            log?.makes != null && log?.attempts != null && log.attempts > 0
              ? Math.round((log.makes / log.attempts) * 100)
              : null;

          return (
            <form
              key={a.id}
              action={saveDrDishLog.bind(null, sessionId)}
              className="border-b border-gray-mid px-3 py-3 last:border-b-0"
            >
              <input type="hidden" name="athleteId" value={a.id} />
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-heading text-sm font-bold text-near-black">{a.name}</span>
                {pct !== null && (
                  <span className="font-sport text-sm font-bold uppercase text-orange">{pct}%</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                    Workout
                  </span>
                  <input
                    name="workout"
                    defaultValue={log?.workout ?? ""}
                    placeholder="Catch & shoot"
                    className="min-h-[44px] rounded-lg border border-gray-mid px-2.5 font-body text-sm focus:border-orange focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                    Focus
                  </span>
                  <input
                    name="focus"
                    defaultValue={log?.focus ?? ""}
                    placeholder="Left wing"
                    className="min-h-[44px] rounded-lg border border-gray-mid px-2.5 font-body text-sm focus:border-orange focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                    Makes
                  </span>
                  <input
                    type="number"
                    name="makes"
                    min={0}
                    defaultValue={log?.makes ?? ""}
                    className="min-h-[44px] rounded-lg border border-gray-mid px-2.5 font-body text-sm focus:border-orange focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                    Attempts
                  </span>
                  <input
                    type="number"
                    name="attempts"
                    min={0}
                    defaultValue={log?.attempts ?? ""}
                    className="min-h-[44px] rounded-lg border border-gray-mid px-2.5 font-body text-sm focus:border-orange focus:outline-none"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="mt-2 min-h-[44px] rounded-lg border border-near-black px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-near-black hover:bg-near-black hover:text-white"
              >
                Save
              </button>
            </form>
          );
        })}
      </div>
      <p className="mt-1.5 font-body text-xs text-gray-dark">
        Entered by hand. The Courts has no Dr. Dish data integration — these are your numbers, not
        the machine&apos;s.
      </p>
    </div>
  );
}
