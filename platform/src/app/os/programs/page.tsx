import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { listOfferings, offeringViewCounts, OFFERING_VIEWS, WARNING_LABELS } from "@/lib/programs/queries";
import { CREATE_PICKER_ORDER, PROGRAM_TYPE_LABELS, SPORTS, gradeRangeLabel } from "@/lib/programs/types";
import { formatCents } from "@/lib/programs/format";
import { can } from "@/lib/os/permissions";
import { Card, EmptyState, PageHeader, Pill, ButtonLink, type Tone } from "../_components/ui";

export const dynamic = "force-dynamic";

// PROGRAMS answers "what are we offering?". SCHEDULE answers "when and where is
// it happening?". They are linked but deliberately not the same screen — this
// one is a catalog you scan for problems, not a calendar.

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  ready_to_publish: "info",
  published: "success",
  registration_closed: "warning",
  completed: "info",
  cancelled: "danger",
  archived: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready_to_publish: "Ready",
  published: "Published",
  registration_closed: "Reg. Closed",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

function fmtDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const f = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
  if (!end || start.getTime() === end.getTime()) return f(start);
  return `${f(start)} – ${f(end)}`;
}

export default async function ProgramsPage({ searchParams }: PageProps<"/os/programs">) {
  const actor = await requireCapability("programs.view");

  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "active";
  const sport = typeof sp.sport === "string" ? sp.sport : undefined;
  const programType = typeof sp.type === "string" ? sp.type : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const [offerings, counts] = await Promise.all([
    listOfferings(actor, { view, sport, programType, q }),
    offeringViewCounts(actor),
  ]);

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { view, sport, type: programType, q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/os/programs${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Programming"
        title="Programs"
        subtitle="Everything The Courts offers. Create it once here; it publishes everywhere."
        actions={
          can(actor, "programs.create") ? (
            <ButtonLink href="/os/programs/new" variant="primary">
              + Create Something
            </ButtonLink>
          ) : null
        }
      />

      {/* Views */}
      <nav aria-label="Program views" className="mb-4 flex flex-wrap gap-1.5">
        {OFFERING_VIEWS.map((v) => {
          const active = view === v.key;
          const count = (counts as Record<string, number>)[v.key];
          return (
            <Link
              key={v.key}
              href={href({ view: v.key })}
              aria-current={active ? "page" : undefined}
              className={`os-eyebrow inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 ${
                active
                  ? "border-near-black bg-near-black text-white"
                  : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
              }`}
            >
              {v.label}
              {count !== undefined && count > 0 ? (
                <span className={active ? "text-white/60" : "text-neutral"}>{count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Filters */}
      <form method="get" action="/os/programs" className="mb-5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <div>
          <label htmlFor="q" className="os-eyebrow mb-1.5 block text-gray-dark">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Fall League, Volleyween, Dr. Dish…"
            className="min-h-11 w-64 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="sport" className="os-eyebrow mb-1.5 block text-gray-dark">
            Sport
          </label>
          <select
            id="sport"
            name="sport"
            defaultValue={sport ?? ""}
            className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          >
            <option value="">All sports</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="os-eyebrow mb-1.5 block text-gray-dark">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={programType ?? ""}
            className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          >
            <option value="">All types</option>
            {CREATE_PICKER_ORDER.map((t) => (
              <option key={t} value={t}>
                {PROGRAM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black"
        >
          Apply
        </button>
        {(q || sport || programType) && (
          <Link href={href({ q: undefined, sport: undefined, type: undefined })} className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">
            Clear
          </Link>
        )}
      </form>

      <Card>
        {offerings.length === 0 ? (
          <EmptyState
            headline="Nothing here yet."
            detail={
              view === "needs_attention"
                ? "No programs are missing a coach, a price, Stripe setup or public copy. That's the goal."
                : "No programs match this view. Try another tab or clear the filters."
            }
            action={
              can(actor, "programs.create") ? (
                <ButtonLink href="/os/programs/new" variant="primary">
                  + Create Something
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {offerings.map((o) => {
              const grades = gradeRangeLabel(o.gradeMin, o.gradeMax);
              const dates = fmtDateRange(o.startDate, o.endDate);
              const targets = [
                o.internalOnly ? "Internal only" : null,
                !o.internalOnly && o.visibleParentApp ? "Parent App" : null,
                !o.internalOnly && o.visibleWebsite ? "Website" : null,
                !o.internalOnly && o.visibleCoachApp ? "Coach App" : null,
              ].filter(Boolean);

              return (
                <li key={o.id}>
                  <Link
                    href={`/os/offerings/${o.id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-warm-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="os-eyebrow mb-1 text-orange">
                          {[o.sport, o.programTypeLabel].filter(Boolean).join(" · ")}
                        </p>
                        <p className="os-heading truncate text-base text-near-black">
                          {o.name}
                          {o.seasonLabel ? (
                            <span className="ml-2 font-normal text-neutral">{o.seasonLabel}</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-sm text-gray-dark">
                          {[grades, dates, formatCents(o.priceCents)].filter(Boolean).join(" · ")}
                        </p>
                        {targets.length > 0 ? (
                          <p className="os-eyebrow mt-1.5 text-neutral">{targets.join(" · ")}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Pill tone={STATUS_TONE[o.status] ?? "neutral"}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Pill>
                        <p className="os-num text-sm text-gray-dark">
                          {o.upcomingSessions} upcoming
                          {o.seats > 0 ? ` · ${o.booked}/${o.seats}` : ""}
                        </p>
                        {o.fillRate !== null && o.totalSessions > 0 ? (
                          <p className="os-eyebrow text-neutral">{o.fillRate}% filled</p>
                        ) : null}
                        {o.waitlistCount > 0 ? (
                          <Pill tone="info">{o.waitlistCount} waiting</Pill>
                        ) : null}
                      </div>
                    </div>

                    {o.warnings.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {o.warnings.map((w) => (
                          <Pill key={w} tone={w === "no_image" || w === "no_description" ? "warning" : "danger"}>
                            {WARNING_LABELS[w]}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
