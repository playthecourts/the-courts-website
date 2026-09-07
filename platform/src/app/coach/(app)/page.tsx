import Link from "next/link";
import { getCurrentCoach, isLeadership } from "@/lib/coach-dal";
import { sessionsForDay, todayActionItems, confirmedCounts, sessionTitle, type CoachSession } from "@/lib/coach-queries";
import { formatLongDate, formatTimeRange, formatTime } from "@/lib/coach-format";
import { capacityLabel } from "@/lib/coach-status";
import { Card, Eyebrow, EmptyState, ActionLink, SectionHeading, Pill } from "@/components/coach/ui";

export const dynamic = "force-dynamic";

function sessionSubtitle(s: CoachSession) {
  // Grade band lives in the program name today (e.g. "3rd–5th Grade"); the
  // team name is the more specific label when there is one.
  return s.team?.name ?? s.program.description ?? null;
}

/** The one card that matters: what's happening right now or next. */
function NextUpCard({ session, confirmed }: { session: CoachSession; confirmed: number }) {
  const registered = session._count.bookings;
  const subtitle = sessionSubtitle(session);

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-orange" />
      <div className="px-5 py-4">
        <Eyebrow className="text-orange">Next Up</Eyebrow>
        <h2 className="mt-1.5 font-display text-xl font-black uppercase leading-tight tracking-tight text-near-black">
          {sessionTitle(session)}
        </h2>
        <p className="mt-1 font-heading text-base font-bold text-near-black">
          {formatTimeRange(session.startTime, session.endTime)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-gray-dark">
          {subtitle && <span>{subtitle}</span>}
          {subtitle && session.resource && <span aria-hidden="true">·</span>}
          {session.resource && <span>{session.resource.name}</span>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill>{capacityLabel(registered, session.capacity)}</Pill>
          {/* Confirmed only means something where families RSVP (team sessions). */}
          {session.teamId && <Pill tone={confirmed > 0 ? "ok" : "neutral"}>{confirmed} Confirmed</Pill>}
        </div>

        <div className="mt-4">
          <ActionLink href={`/coach/sessions/${session.id}`}>Open Session</ActionLink>
        </div>
      </div>
    </Card>
  );
}

function LaterRow({ session }: { session: CoachSession }) {
  const subtitle = sessionSubtitle(session);
  return (
    <Link
      href={`/coach/sessions/${session.id}`}
      className="flex min-h-[64px] items-center gap-3 border-b border-gray-mid px-4 py-3 last:border-b-0 hover:bg-warm-stone/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
    >
      <span className="w-[68px] shrink-0 font-sport text-sm font-bold uppercase text-charcoal">
        {formatTime(session.startTime)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-sm font-bold text-near-black">
          {sessionTitle(session)}
        </span>
        {subtitle && <span className="block truncate font-body text-xs text-gray-dark">{subtitle}</span>}
      </span>
      <span className="shrink-0 font-sport text-[11px] font-bold uppercase text-gray-dark">
        {session._count.bookings}/{session.capacity}
      </span>
    </Link>
  );
}

export default async function CoachTodayPage() {
  const actor = await getCurrentCoach();
  const now = new Date();

  const [sessions, actionItems] = await Promise.all([
    sessionsForDay(actor, now),
    todayActionItems(actor, now),
  ]);
  const confirmed = await confirmedCounts(sessions.map((s) => s.id));

  // "Next up" is the session in progress, or the next one to start. Sessions
  // that already ended drop to a separate list rather than disappearing —
  // a coach still needs to get back into one to finish attendance.
  const upcoming = sessions.filter((s) => s.endTime >= now);
  const finished = sessions.filter((s) => s.endTime < now);
  const nextUp = upcoming[0] ?? null;
  const later = upcoming.slice(1);

  const firstName = actor.name.split(" ")[0];

  return (
    <div>
      <div className="mb-5">
        <Eyebrow className="text-orange">{formatLongDate(now)}</Eyebrow>
        <h1 className="mt-1 font-display text-[28px] font-black uppercase leading-none tracking-tight text-near-black">
          {sessions.length > 0 ? "Your Court Today." : `Nothing on Deck, ${firstName}.`}
        </h1>
      </div>

      {/* Action items sit ABOVE the session card only when something is
          genuinely wrong — otherwise the coach's first glance is their court. */}
      {actionItems.length > 0 && (
        <section className="mb-5">
          <SectionHeading>Before You Hit the Court</SectionHeading>
          <Card>
            <ul>
              {actionItems.map((item, i) => (
                <li key={i} className="border-b border-gray-mid last:border-b-0">
                  <Link
                    href={item.href}
                    className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-warm-stone/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${item.urgent ? "bg-red-600" : "bg-orange"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-medium text-near-black">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className="block font-body text-xs text-gray-dark">{item.detail}</span>
                      )}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-gray-dark">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {nextUp ? (
        <NextUpCard session={nextUp} confirmed={confirmed.get(nextUp.id) ?? 0} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Court's Quiet."
          body="Nothing assigned today. Enjoy it while it lasts."
          action={<ActionLink href="/coach/schedule" variant="secondary">See My Schedule</ActionLink>}
        />
      ) : (
        <EmptyState
          title="That's a Wrap."
          body="Everything on today's schedule is done. Anything unfinished is below."
        />
      )}

      {later.length > 0 && (
        <section className="mt-6">
          <SectionHeading>Later Today</SectionHeading>
          <Card>
            {later.map((s) => (
              <LaterRow key={s.id} session={s} />
            ))}
          </Card>
        </section>
      )}

      {finished.length > 0 && (
        <section className="mt-6">
          <SectionHeading>Earlier Today</SectionHeading>
          <Card>
            {finished.map((s) => (
              <LaterRow key={s.id} session={s} />
            ))}
          </Card>
        </section>
      )}

      {isLeadership(actor) && (
        <div className="mt-6">
          <ActionLink href="/coach/dashboard" variant="secondary">
            {actor.isAdmin ? "Courts Operations" : `${actor.scopedSports.join(" & ")} Today`}
          </ActionLink>
        </div>
      )}
    </div>
  );
}
