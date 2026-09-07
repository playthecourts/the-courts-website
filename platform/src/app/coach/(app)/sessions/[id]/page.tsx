import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertSessionAccess, canManageCapacity } from "@/lib/coach-dal";
import { formatLongDate, formatTimeRange, formatGrade, initials } from "@/lib/coach-format";
import { capacityLabel, pastDueAthleteIds, registrationStatusFor, trainingPlanStatusFor } from "@/lib/coach-status";
import { activeFlagsFor } from "@/lib/coach-queries";
import { Card, Eyebrow, Pill, SectionHeading, BackLink, ActionLink } from "@/components/coach/ui";
import SessionRoster, { type RosterRow } from "./session-roster";
import SessionPlan from "./session-plan";
import DrDishBlock from "./dr-dish-block";
import WaitlistRow from "./waitlist-row";
import { saveSessionNote, requestCoverage, updateCapacity } from "../actions";

export const dynamic = "force-dynamic";

export default async function CoachSessionPage(props: PageProps<"/coach/sessions/[id]">) {
  const actor = await getCurrentCoach();
  const { id } = await props.params;

  // Authorization first — before a single field of this session is read.
  await assertSessionAccess(actor, id);

  const session = await prisma.session.findUniqueOrThrow({
    where: { id },
    include: {
      program: true,
      team: true,
      resource: true,
      coaches: { include: { staff: { select: { id: true, name: true } } } },
      plan: { include: { items: { orderBy: { position: "asc" } } } },
      notes: { include: { staff: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      bookings: {
        where: { status: { not: "cancelled" } },
        include: { athlete: true, attendance: true },
        orderBy: [{ athlete: { firstName: "asc" } }, { athlete: { lastName: "asc" } }],
      },
      waitlistEntries: {
        where: { status: "waiting" },
        include: { athlete: true },
        orderBy: { position: "asc" },
      },
      coverageRequests: { where: { status: { in: ["open", "assigned"] } } },
      drDishLogs: true,
    },
  });

  const athleteIds = session.bookings.map((b) => b.athleteId);
  const [flags, pastDue] = await Promise.all([
    activeFlagsFor(athleteIds),
    pastDueAthleteIds(athleteIds),
  ]);

  // Training-plan coverage, translated out of Stripe terms (see coach-status.ts).
  const planStatuses = await Promise.all(
    session.bookings.map(async (b) => [b.athleteId, await trainingPlanStatusFor(b.athleteId)] as const)
  );
  const planMap = new Map(planStatuses);

  const rows: RosterRow[] = session.bookings.map((b) => {
    const reg = registrationStatusFor(b.status, pastDue.has(b.athleteId));
    const plan = planMap.get(b.athleteId);
    return {
      bookingId: b.id,
      athleteId: b.athleteId,
      firstName: b.athlete.firstName,
      lastName: b.athlete.lastName,
      grade: formatGrade(b.athlete.grade),
      initials: initials(b.athlete.firstName, b.athlete.lastName),
      attendance: b.attendance?.status ?? null,
      rsvp: b.rsvpStatus,
      flags: flags.get(b.athleteId) ?? [],
      registrationLabel: reg.label,
      registrationTone: reg.tone,
      planLabel:
        plan?.kind === "covered"
          ? `${plan.remaining} of ${plan.total} left`
          : plan?.kind === "exhausted"
            ? "Session not covered"
            : null,
    };
  });

  const canManage = canManageCapacity(actor, session.program.sport);
  const isTeamSession = Boolean(session.teamId);
  const isDrDish =
    session.resource?.resourceType === "shooting_machine" || /dr\.?\s*dish/i.test(session.program.name);
  // Guided Dr. Dish has a coach on it; self-service does not, and deliberately
  // gets no coaching documentation.
  const isGuidedDrDish = isDrDish && session.coaches.length > 0;
  const openCoverage = session.coverageRequests.find((c) => c.status === "open");

  return (
    <div>
      <BackLink href="/coach">Today</BackLink>

      <Card className="mb-5 overflow-hidden">
        <div className="h-1.5 bg-orange" />
        <div className="px-4 py-4">
          <Eyebrow className="text-orange">Session</Eyebrow>
          <h1 className="mt-1 font-display text-xl font-black uppercase leading-tight tracking-tight text-near-black">
            {session.program.name}
          </h1>
          <p className="mt-1 font-heading text-sm font-bold text-near-black">
            {formatLongDate(session.startTime)} · {formatTimeRange(session.startTime, session.endTime)}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-2 font-body text-sm text-gray-dark">
            {session.team && <span>{session.team.name}</span>}
            {session.resource && <span>· {session.resource.name}</span>}
          </div>
          {session.coaches.length > 0 && (
            <p className="mt-1.5 font-body text-xs text-gray-dark">
              {session.coaches
                .map((c) => `${c.staff.name}${c.role === "substitute" ? " (sub)" : ""}`)
                .join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={session.bookings.length >= session.capacity ? "accent" : "neutral"}>
              {capacityLabel(session.bookings.length, session.capacity)}
            </Pill>
            {session.status === "cancelled" && <Pill tone="alert">Cancelled</Pill>}
            {openCoverage && <Pill tone="warn">Coverage Requested</Pill>}
          </div>
        </div>
      </Card>

      {/* Roster + attendance — the reason a coach opened this screen. */}
      <section className="mb-6">
        <SessionRoster sessionId={session.id} rows={rows} showRsvp={isTeamSession} />
      </section>

      {session.waitlistEntries.length > 0 && (
        <section className="mb-6">
          <SectionHeading>Waitlist · {session.waitlistEntries.length} waiting</SectionHeading>
          <Card>
            {session.waitlistEntries.map((entry) => (
              <WaitlistRow
                key={entry.id}
                sessionId={session.id}
                entryId={entry.id}
                name={`${entry.athlete.firstName} ${entry.athlete.lastName}`}
                position={entry.position}
                canManage={canManage}
              />
            ))}
          </Card>
        </section>
      )}

      {isGuidedDrDish && (
        <section className="mb-6">
          <DrDishBlock
            sessionId={session.id}
            athletes={session.bookings.map((b) => ({
              id: b.athleteId,
              name: `${b.athlete.firstName} ${b.athlete.lastName}`,
            }))}
            logs={session.drDishLogs.map((l) => ({
              athleteId: l.athleteId,
              workout: l.workout,
              makes: l.makes,
              attempts: l.attempts,
              focus: l.focus,
            }))}
          />
        </section>
      )}

      {!isDrDish && (
        <section className="mb-6">
          <SessionPlan
            sessionId={session.id}
            items={session.plan?.items.map((i) => ({ id: i.id, minutes: i.minutes, activity: i.activity })) ?? []}
          />
        </section>
      )}

      {/* Session notes — about the group, never parent-facing. */}
      <section className="mb-6">
        <SectionHeading>Session Notes</SectionHeading>
        <Card className="px-4 py-3">
          <form action={saveSessionNote.bind(null, session.id)} className="flex flex-col gap-2">
            <label htmlFor="session-note" className="sr-only">
              What did the group work on?
            </label>
            <textarea
              id="session-note"
              name="body"
              rows={3}
              placeholder="Worked on: finishing, transition spacing, closeouts…"
              className="w-full rounded-lg border border-gray-mid px-3 py-2 font-body text-sm text-near-black focus:border-orange focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] self-start rounded-lg bg-charcoal px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-white hover:bg-near-black"
            >
              Save Note
            </button>
          </form>
          {session.notes.length > 0 && (
            <ul className="mt-3 border-t border-gray-mid pt-3">
              {session.notes.map((n) => (
                <li key={n.id} className="mb-2.5 last:mb-0">
                  <p className="font-body text-sm text-near-black">{n.body}</p>
                  <p className="font-sport text-[10px] uppercase tracking-wide text-gray-dark">
                    {n.staff.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-body text-xs text-gray-dark">
            Session notes are staff-only. Parents never see them.
          </p>
        </Card>
      </section>

      <section className="mb-6 flex flex-col gap-2">
        <ActionLink href={`/coach/messages/new?sessionId=${session.id}`} variant="secondary">
          Message This Group
        </ActionLink>
        <ActionLink href={`/coach/incidents/new?sessionId=${session.id}`} variant="secondary">
          Report an Incident
        </ActionLink>
      </section>

      {/* Coverage + capacity are secondary; tucked behind a disclosure so they
          don't compete with attendance for attention on a phone. */}
      <details className="mb-4 rounded-xl border border-gray-mid bg-white">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center px-4 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Session Admin
        </summary>
        <div className="border-t border-gray-mid px-4 py-3">
          {openCoverage ? (
            <p className="mb-3 rounded-lg bg-warm-stone px-3 py-2 font-body text-sm text-near-black">
              Coverage requested. A head coach or admin will assign a replacement.
            </p>
          ) : (
            <form action={requestCoverage.bind(null, session.id)} className="mb-4 flex flex-col gap-2">
              <label
                htmlFor="coverage-reason"
                className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark"
              >
                Need Coverage
              </label>
              <input
                id="coverage-reason"
                name="reason"
                placeholder="Reason (optional)"
                className="min-h-[44px] rounded-lg border border-gray-mid px-3 font-body text-sm focus:border-orange focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] self-start rounded-lg border border-near-black px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-near-black hover:bg-near-black hover:text-white"
              >
                Request Coverage
              </button>
            </form>
          )}

          {canManage ? (
            <form action={updateCapacity.bind(null, session.id)} className="flex items-end gap-2">
              <label className="flex flex-col gap-1 font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">
                Capacity
                <input
                  type="number"
                  name="capacity"
                  min={0}
                  defaultValue={session.capacity}
                  className="min-h-[44px] w-24 rounded-lg border border-gray-mid px-3 font-body text-sm normal-case focus:border-orange focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg border border-near-black px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-near-black hover:bg-near-black hover:text-white"
              >
                Update
              </button>
            </form>
          ) : (
            <p className="font-body text-xs text-gray-dark">
              Capacity is set by a head coach or admin.
            </p>
          )}
        </div>
      </details>

      <p className="pb-2 text-center font-body text-xs text-gray-dark">
        <Link href="/coach/schedule" className="underline hover:text-orange">
          Back to schedule
        </Link>
      </p>
    </div>
  );
}
