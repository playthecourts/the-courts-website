import { savePlanItem, deletePlanItem, movePlanItem } from "../actions";
import { SectionHeading } from "@/components/coach/ui";

// A short, timed list of blocks. Server component with plain forms — no client
// JS at all, which keeps it usable on a bad connection. Reordering is
// up/down buttons rather than drag-and-drop: more reliable with a thumb, and
// accessible from the keyboard for free.
export default function SessionPlan({
  sessionId,
  items,
}: {
  sessionId: string;
  items: { id: string; minutes: number; activity: string }[];
}) {
  const total = items.reduce((sum, i) => sum + i.minutes, 0);

  return (
    <div>
      <SectionHeading>
        Today&apos;s Plan{total > 0 ? ` · ${total} min` : ""}
      </SectionHeading>
      <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
        {items.length === 0 ? (
          <p className="px-4 py-4 font-body text-sm text-gray-dark">
            No plan yet. Add a block or two — it doesn&apos;t have to be the whole practice.
          </p>
        ) : (
          <ul>
            {items.map((item, idx) => (
              <li
                key={item.id}
                className="flex min-h-[52px] items-center gap-3 border-b border-gray-mid px-3 py-2 last:border-b-0"
              >
                <span className="w-14 shrink-0 font-sport text-sm font-bold uppercase text-orange">
                  {item.minutes} min
                </span>
                <span className="min-w-0 flex-1 font-body text-sm text-near-black">
                  {item.activity}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <form action={movePlanItem.bind(null, sessionId, item.id, "up")}>
                    <button
                      type="submit"
                      disabled={idx === 0}
                      aria-label={`Move ${item.activity} earlier`}
                      className="flex h-9 w-9 items-center justify-center rounded border border-gray-mid text-gray-dark disabled:opacity-30 hover:border-near-black"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={movePlanItem.bind(null, sessionId, item.id, "down")}>
                    <button
                      type="submit"
                      disabled={idx === items.length - 1}
                      aria-label={`Move ${item.activity} later`}
                      className="flex h-9 w-9 items-center justify-center rounded border border-gray-mid text-gray-dark disabled:opacity-30 hover:border-near-black"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={deletePlanItem.bind(null, sessionId, item.id)}>
                    <button
                      type="submit"
                      aria-label={`Remove ${item.activity}`}
                      className="flex h-9 w-9 items-center justify-center rounded border border-gray-mid text-gray-dark hover:border-red-600 hover:text-red-600"
                    >
                      ×
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          action={savePlanItem.bind(null, sessionId)}
          className="flex items-end gap-2 border-t border-gray-mid bg-warm-stone/40 px-3 py-2.5"
        >
          <label className="flex flex-col gap-1">
            <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
              Min
            </span>
            <input
              type="number"
              name="minutes"
              min={1}
              max={180}
              required
              defaultValue={10}
              className="min-h-[44px] w-16 rounded-lg border border-gray-mid px-2 font-body text-sm focus:border-orange focus:outline-none"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
              Block
            </span>
            <input
              name="activity"
              required
              placeholder="Ball handling warmup"
              className="min-h-[44px] w-full rounded-lg border border-gray-mid px-3 font-body text-sm focus:border-orange focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="min-h-[44px] shrink-0 rounded-lg bg-charcoal px-3 font-sport text-[11px] font-bold uppercase tracking-wide text-white hover:bg-near-black"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
