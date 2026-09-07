import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertTeamAccess } from "@/lib/coach-dal";
import { formatGrade, initials, formatShortDate, formatTime, relativeDayLabel } from "@/lib/coach-format";
import { Card, Eyebrow, Pill, SectionHeading, BackLink, Avatar, ActionLink } from "@/components/coach/ui";

export const dynamic = "force-dynamic";

// Roster size guidance. Not a hard rule — the app flags an unusual roster and
// lets a human decide, rather than moving anyone automatically.
const ROSTER_MIN = 6;
const ROSTER_MAX = 10;

export default async function CoachTeamPage(props: PageProps<"/coach/teams/[id]">) {
  const actor = await getCurrentCoach();
  const { id } = await props.params;

  await assertTeamAccess(actor, id);

  const now = new Date();
  const team = await prisma.team.findUniqueOrThrow({
    where: { id },
    include: {
      program: true,
      coaches: { include: { staff: { select: { name: true } } } },
      members: {
        include: { athlete: { select: { id: true, firstName: true, lastName: true, grade: true } } },
        orderBy: { athlete: { firstName: "asc" } },
      },
      sessions: {
        where: { status: "scheduled" },
        orderBy: { startTime: "asc" },
        include: {
          resource: true,
          program: true,
          _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
        },
      },
    },
  });

  const upcoming = team.sessions.filter((s) => s.endTime >= now);
  const past = team.sessions.filter((s) => s.endTime < now).slice(-4).reverse();

  // Parent RSVPs for the next team session — what the coach actually needs
  // to know before Saturday.
  const nextSession = upcoming[0] ?? null;
  const rsvps = nextSession
    ? await prisma.booking.findMany({
        where: { sessionId: nextSession.id, status: { not: "cancelled" } },
        include: { athlete: { select: { firstName: true, lastName: true } } },
      })
    : [];
  const going = rsvps.filter((r) => r.rsvpStatus === "going");
  const notGoing = rsvps.filter((r) => r.rsvpStatus === "not_going");
  const noReply = rsvps.filter((r) => !r.rsvpStatus);

  const rosterCount = team.members.length;
  const rosterWarning =
    rosterCount < ROSTER_MIN
      ? `Unusually small roster — ${rosterCount} players.`
      : rosterCount > ROSTER_MAX
        ? `Unusually large roster — ${rosterCount} players.`
        : null;

  return (
    <div>
      <BackLink href="/coach/teams">Teams</BackLink>

      <Card className="mb-5 overflow-hidden">
        <div className="h-1.5 bg-orange" />
        <div className="px-4 py-4">
          <Eyebrow className="text-orange">{team.program.name}</Eyebrow>
          <h1 className="mt-1 font-display text-xl font-black uppercase leading-tight tracking-tight text-near-black">
            {team.name}
          </h1>
          <p className="mt-1 font-body text-sm text-gray-dark">
            {[team.division, team.coaches.map((c) => c.staff.name).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={rosterWarning ? "warn" : "neutral"}>
              {rosterCount} / {ROSTER_MAX} Players
            </Pill>
          </div>
          {rosterWarning && (
            <p className="mt-2 font-body text-sm text-amber-900">{rosterWarning}</p>
          )}
        </div>
      </Card>

      {nextSession && (
        <section className="mb-5">
          <SectionHeading>
            Next Up · {relativeDayLabel(nextSession.startTime, now)} {formatTime(nextSession.startTime)}
          </SectionHeading>
          <Card className="px-4 py-3">
            <p className="font-heading text-sm font-bold text-near-black">
              {nextSession.program.name}
              {nextSession.resource ? ` · ${nextSession.resource.name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="ok">{going.length} Going</Pill>
              <Pill tone={notGoing.length > 0 ? "alert" : "neutral"}>
                {notGoing.length} Can&apos;t Make It
              </Pill>
              <Pill tone={noReply.length > 0 ? "warn" : "neutral"}>{noReply.length} No Reply</Pill>
            </div>
            {notGoing.length > 0 && (
              <p className="mt-2 font-body text-sm text-near-black">
                Out:{" "}
                {notGoing.map((r) => `${r.athlete.firstName} ${r.athlete.lastName}`).join(", ")}
              </p>
            )}
            <div className="mt-3">
              <ActionLink href={`/coach/sessions/${nextSession.id}`}>Open Session</ActionLink>
            </div>
          </Card>
        </section>
      )}

      <section className="mb-5">
        <SectionHeading>Roster</SectionHeading>
        <Card>
          {team.members.length === 0 ? (
            <p className="px-4 py-6 text-center font-body text-sm text-gray-dark">
              No players placed on this team yet.
            </p>
          ) : (
            team.members.map((m) => (
              <Link
                key={m.athlete.id}
                href={`/coach/athletes/${m.athlete.id}`}
                className="flex min-h-[56px] items-center gap-3 border-b border-gray-mid px-4 py-2 last:border-b-0 hover:bg-warm-stone/50"
              >
                <Avatar initials={initials(m.athlete.firstName, m.athlete.lastName)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-sm font-bold text-near-black">
                    {m.athlete.firstName} {m.athlete.lastName}
                  </span>
                  {m.athlete.grade && (
                    <span className="block font-body text-xs text-gray-dark">
                      {formatGrade(m.athlete.grade)}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className="text-gray-dark">
                  ›
                </span>
              </Link>
            ))
          )}
        </Card>
      </section>

      {upcoming.length > 0 && (
        <section className="mb-5">
          <SectionHeading>Practices &amp; Games</SectionHeading>
          <Card>
            {upcoming.map((s) => (
              <Link
                key={s.id}
                href={`/coach/sessions/${s.id}`}
                className="flex min-h-[56px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50"
              >
                <span className="w-[86px] shrink-0 font-sport text-xs font-bold uppercase text-charcoal">
                  {relativeDayLabel(s.startTime, now)}
                </span>
                <span className="min-w-0 flex-1 font-body text-sm text-near-black">
                  {formatTime(s.startTime)}
                  {s.resource ? ` · ${s.resource.name}` : ""}
                </span>
                <Pill>{s._count.bookings}</Pill>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {past.length > 0 && (
        <section className="mb-5">
          <SectionHeading>Recent</SectionHeading>
          <Card>
            {past.map((s) => (
              <Link
                key={s.id}
                href={`/coach/sessions/${s.id}`}
                className="flex min-h-[48px] items-center gap-3 border-b border-gray-mid px-4 py-2 last:border-b-0 hover:bg-warm-stone/50"
              >
                <span className="font-body text-sm text-gray-dark">
                  {formatShortDate(s.startTime)} · {formatTime(s.startTime)}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      <div className="pb-2">
        <ActionLink href={`/coach/messages/new?teamId=${team.id}`}>Message This Team</ActionLink>
      </div>
    </div>
  );
}
