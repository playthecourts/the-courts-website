import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { loadWeek, weekStart, utilization } from "@/lib/programs/schedule-view";
import { CREATE_PICKER_ORDER, PROGRAM_TYPE_LABELS, SPORTS } from "@/lib/programs/types";
import { PageHeader } from "../_components/ui";
import { WeekGrid } from "./week-grid";

export const dynamic = "force-dynamic";

// SCHEDULE answers "when and where is it happening?". It is an operational tool,
// not a marketing surface: cards are compact and scannable, and everything on
// one is something you'd act on — time, program, coach, court, fill.

export default async function SchedulePage({ searchParams }: PageProps<"/os/schedule">) {
  const actor = await requireCapability("schedule.view");
  const sp = await searchParams;

  const weekParam = typeof sp.week === "string" ? sp.week : null;
  const anchor = weekParam ? new Date(`${weekParam}T00:00:00Z`) : new Date();
  const filters = {
    sport: typeof sp.sport === "string" ? sp.sport : undefined,
    coachId: typeof sp.coach === "string" ? sp.coach : undefined,
    resourceId: typeof sp.court === "string" ? sp.court : undefined,
    programType: typeof sp.type === "string" ? sp.type : undefined,
    offeringId: typeof sp.offering === "string" ? sp.offering : undefined,
  };

  const { start, cards, closures, resources, coaches } = await loadWeek(actor, anchor, filters);
  const util = utilization(cards, resources.length);

  const prev = new Date(start); prev.setUTCDate(prev.getUTCDate() - 7);
  const next = new Date(start); next.setUTCDate(next.getUTCDate() + 7);
  const key = (d: Date) => d.toISOString().slice(0, 10);

  function href(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      week: key(start),
      sport: filters.sport,
      coach: filters.coachId,
      court: filters.resourceId,
      type: filters.programType,
      offering: filters.offeringId,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/os/schedule?${params.toString()}`;
  }

  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(start.getTime() + 6 * 86_400_000));

  return (
    <div>
      <PageHeader
        eyebrow="Facility"
        title="Schedule"
        subtitle={`${weekLabel} – ${endLabel} · ${cards.filter((c) => c.status === "scheduled").length} sessions · ${util.percent}% of court hours used`}
        actions={
          <div className="flex items-center gap-1.5">
            <Link href={href({ week: key(prev) })} className="os-heading inline-flex min-h-11 items-center rounded-lg border border-gray-mid bg-white px-3 text-sm hover:border-near-black">
              ← Prev
            </Link>
            <Link href={href({ week: key(weekStart(new Date())) })} className="os-heading inline-flex min-h-11 items-center rounded-lg border border-gray-mid bg-white px-3 text-sm hover:border-near-black">
              This Week
            </Link>
            <Link href={href({ week: key(next) })} className="os-heading inline-flex min-h-11 items-center rounded-lg border border-gray-mid bg-white px-3 text-sm hover:border-near-black">
              Next →
            </Link>
          </div>
        }
      />

      <form method="get" action="/os/schedule" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="week" value={key(start)} />
        {[
          { name: "sport", label: "Sport", value: filters.sport, options: SPORTS.map((s) => [s, s] as const) },
          { name: "type", label: "Type", value: filters.programType, options: CREATE_PICKER_ORDER.map((t) => [t, PROGRAM_TYPE_LABELS[t]] as const) },
          { name: "court", label: "Court", value: filters.resourceId, options: resources.map((r) => [r.id, r.name] as const) },
          { name: "coach", label: "Coach", value: filters.coachId, options: coaches.map((c) => [c.id, c.name] as const) },
        ].map((f) => (
          <div key={f.name}>
            <label htmlFor={f.name} className="os-eyebrow mb-1.5 block text-gray-dark">{f.label}</label>
            <select id={f.name} name={f.name} defaultValue={f.value ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
              <option value="">All</option>
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
          Filter
        </button>
        {(filters.sport || filters.coachId || filters.resourceId || filters.programType || filters.offeringId) ? (
          <Link href={`/os/schedule?week=${key(start)}`} className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">
            Clear
          </Link>
        ) : null}
      </form>

      <WeekGrid weekStartIso={start.toISOString()} cards={cards} closures={closures} />
    </div>
  );
}
