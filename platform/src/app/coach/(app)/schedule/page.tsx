import { sessionTitle } from "@/lib/coach-queries";
import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, sessionScope, selectableSports, canManageSport } from "@/lib/coach-dal";
import { startOfDay, addDays, relativeDayLabel, formatTime, formatLongDate } from "@/lib/coach-format";
import { Card, PageTitle, EmptyState, Pill } from "@/components/coach/ui";

export const dynamic = "force-dynamic";

const RANGE_DAYS = 14;

export default async function CoachSchedulePage(props: PageProps<"/coach/schedule">) {
  const actor = await getCurrentCoach();
  const params = await props.searchParams;
  const requestedScope = typeof params.scope === "string" ? params.scope : "mine";

  const sports = selectableSports(actor);

  // Scope is validated server-side, not trusted from the query string: asking
  // for ?scope=Volleyball as a basketball head coach falls back to "mine"
  // rather than widening access. sessionScope() is ALSO applied below, so even
  // a bug here couldn't leak another sport's sessions.
  let scope = "mine";
  if (requestedScope === "all" && actor.isAdmin) scope = "all";
  else if (sports.includes(requestedScope) && canManageSport(actor, requestedScope)) {
    scope = requestedScope;
  }

  const from = startOfDay(new Date());
  const to = addDays(from, RANGE_DAYS);

  const scopeFilter =
    scope === "all"
      ? {}
      : scope === "mine"
        ? {
            OR: [
              { coaches: { some: { staffUserId: actor.id } } },
              { team: { coaches: { some: { staffUserId: actor.id } } } },
            ],
          }
        : { program: { sport: scope } };

  const sessions = await prisma.session.findMany({
    where: {
      AND: [sessionScope(actor), scopeFilter, { startTime: { gte: from, lte: to } }, { status: "scheduled" }],
    },
    orderBy: { startTime: "asc" },
    include: {
      program: true,
      team: true,
      resource: true,
      coaches: { include: { staff: { select: { name: true } } } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  // Group into day buckets for the agenda view — the default on a phone.
  const days = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = startOfDay(s.startTime).toISOString();
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  const scopeOptions: { key: string; label: string }[] = [
    { key: "mine", label: "My Schedule" },
    ...sports.map((s) => ({ key: s, label: `All ${s}` })),
    ...(actor.isAdmin ? [{ key: "all", label: "All Courts" }] : []),
  ];

  const now = new Date();

  return (
    <div>
      <PageTitle eyebrow="Next 2 Weeks" sub={formatLongDate(now)}>
        Schedule
      </PageTitle>

      {scopeOptions.length > 1 && (
        <div
          role="group"
          aria-label="Schedule scope"
          className="mb-4 flex gap-1.5 overflow-x-auto pb-1"
        >
          {scopeOptions.map((opt) => {
            const active = scope === opt.key;
            return (
              <Link
                key={opt.key}
                href={`/coach/schedule?scope=${encodeURIComponent(opt.key)}` as Route}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-[40px] shrink-0 items-center rounded-full border px-3.5 font-sport text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-near-black bg-near-black text-white"
                    : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title="Court's Quiet."
          body={
            scope === "mine"
              ? "Nothing assigned to you in the next two weeks."
              : "Nothing scheduled in the next two weeks."
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...days.entries()].map(([key, daySessions]) => (
            <section key={key}>
              <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                {relativeDayLabel(new Date(key), now)}
              </h2>
              <Card>
                {daySessions.map((s) => {
                  const otherCoaches = s.coaches.map((c) => c.staff.name).join(", ");
                  return (
                    <Link
                      key={s.id}
                      href={`/coach/sessions/${s.id}`}
                      className="flex min-h-[68px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
                    >
                      <span className="w-[68px] shrink-0 font-sport text-sm font-bold uppercase text-charcoal">
                        {formatTime(s.startTime)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-heading text-sm font-bold text-near-black">
                          {sessionTitle(s)}
                        </span>
                        <span className="block truncate font-body text-xs text-gray-dark">
                          {[s.team?.name, s.resource?.name, scope !== "mine" ? otherCoaches : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0">
                        <Pill tone={s._count.bookings >= s.capacity ? "accent" : "neutral"}>
                          {s._count.bookings}/{s.capacity}
                        </Pill>
                      </span>
                    </Link>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
