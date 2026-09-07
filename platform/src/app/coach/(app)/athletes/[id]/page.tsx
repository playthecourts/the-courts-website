import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertAthleteAccess, sessionScope, isLeadership } from "@/lib/coach-dal";
import { formatGrade, formatShortDate, formatTime, relativeDayLabel } from "@/lib/coach-format";
import { trainingPlanStatusFor, pastDueAthleteIds } from "@/lib/coach-status";
import { tagsForSport } from "@/lib/coach-tags";
import { FLAG_LABELS } from "@/lib/coach-queries";
import { Card, Eyebrow, Pill, SectionHeading, BackLink, ActionLink } from "@/components/coach/ui";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { HealthAlertBadge, PickupRestrictionBadge, MediaStatusBadge } from "@/components/athlete/badges";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { displayName, coachingPreferenceLabels, competitiveMeterLabel } from "@/lib/athlete";
import { publishedReportsFor } from "@/lib/progress";
import { quarterLabel, reportingQuarter } from "@/lib/quarters";
import NoteComposer from "./note-composer";
import EmergencyInfo from "./emergency-info";

export const dynamic = "force-dynamic";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Here",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export default async function CoachAthletePage(props: PageProps<"/coach/athletes/[id]">) {
  const actor = await getCurrentCoach();
  const { id } = await props.params;
  const params = await props.searchParams;
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : null;

  await assertAthleteAccess(actor, id);

  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      nickname: true,
      photoPath: true,
      // The context a coach reads before the session — the athlete's own goal
      // and how they like to be pushed. These are preferences, never metrics.
      goal: true,
      coachingPreferences: true,
      competitiveMeter: true,
      parentCoachNote: true,
      // Only the EXISTENCE of safety information, never the text. The detail
      // comes from the audited reveal below.
      hasMedicalInfo: true,
      hasCustodyRestrictions: true,
      mediaConsent: { select: { status: true } },
      // Deliberately NOT selected: dob, gender, medicalNotes, emergencyContact,
      // custodyRestrictions. The medical/emergency values are reachable only
      // through the audited reveal action; the custody text is not reachable by
      // a coach at all, at any role.
      family: {
        select: {
          id: true,
          guardians: {
            select: { isPrimary: true, guardian: { select: { name: true } } },
          },
        },
      },
      memberships: {
        where: { status: { in: ["active", "past_due"] } },
        select: { status: true, plan: { select: { name: true } } },
      },
      teamMemberships: {
        select: { team: { select: { id: true, name: true, division: true, program: { select: { name: true, sport: true } } } } },
      },
      flags: { where: { active: true }, select: { flagType: true, note: true } },
    },
  });

  const now = new Date();

  // Recent + upcoming activity, restricted to sessions this coach may see.
  // A coach never sees an athlete's schedule outside their own scope.
  const [recent, upcoming, notes, pastDue, plan, photoUrl, reports] = await Promise.all([
    prisma.booking.findMany({
      where: {
        athleteId: id,
        status: { not: "cancelled" },
        session: { AND: [sessionScope(actor), { startTime: { lt: now } }] },
      },
      orderBy: { session: { startTime: "desc" } },
      take: 6,
      include: { session: { include: { program: true } }, attendance: true },
    }),
    prisma.booking.findMany({
      where: {
        athleteId: id,
        status: { not: "cancelled" },
        session: { AND: [sessionScope(actor), { startTime: { gte: now } }] },
      },
      orderBy: { session: { startTime: "asc" } },
      take: 4,
      include: { session: { include: { program: true, resource: true } } },
    }),
    // A coach sees their own notes plus any other staff note about this
    // athlete — internal continuity matters — but parent-shared status is
    // always displayed so nobody misreads what a family can see.
    prisma.coachNote.findMany({
      where: { athleteId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { staff: { select: { name: true } } },
    }),
    pastDueAthleteIds([id]),
    trainingPlanStatusFor(id),
    signedPhotoUrl(athlete.photoPath),
    publishedReportsFor(id),
  ]);

  // Sport drives which quick tags appear — volleyball coaches never get
  // basketball vocabulary.
  const sportGuess =
    upcoming[0]?.session.program.sport ??
    recent[0]?.session.program.sport ??
    athlete.teamMemberships[0]?.team.program.sport ??
    null;

  const coachingPrefs = coachingPreferenceLabels(athlete.coachingPreferences);
  const meterLabel = competitiveMeterLabel(athlete.competitiveMeter);

  const guardianNames = athlete.family.guardians
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((g) => g.guardian.name);

  return (
    <div>
      <BackLink href={sessionId ? `/coach/sessions/${sessionId}` : "/coach/athletes"}>
        {sessionId ? "Session" : "Athletes"}
      </BackLink>

      <Card className="mb-4 px-4 py-4">
        <div className="flex items-center gap-3">
          <AthleteAvatar athlete={athlete} photoUrl={photoUrl} size="md" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-black uppercase leading-tight tracking-tight text-near-black">
              {displayName(athlete)}
            </h1>
            {athlete.nickname && (
              <p className="font-body text-xs text-gray-dark">
                {athlete.firstName} {athlete.lastName}
              </p>
            )}
            <p className="font-body text-sm text-gray-dark">
              {[formatGrade(athlete.grade), sportGuess].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {athlete.flags.map((f) => (
            <Pill key={f.flagType} tone="accent">
              {FLAG_LABELS[f.flagType] ?? f.flagType}
            </Pill>
          ))}
          {pastDue.has(id) ? (
            <Pill tone="warn">Payment Required</Pill>
          ) : (
            <Pill tone="ok">Registered</Pill>
          )}
          {plan.kind === "covered" && (
            <Pill>
              {plan.planName} · {plan.remaining} left
            </Pill>
          )}
          {plan.kind === "exhausted" && <Pill tone="warn">Session not covered</Pill>}
        </div>

        {/* Guardian NAMES only. No email, no phone, no address — a coach does
            not need a family's contact details to run a session, and messaging
            goes through the platform (see /coach/messages). */}
        {guardianNames.length > 0 && (
          <p className="mt-3 font-body text-sm text-gray-dark">
            <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
              Parent / Guardian
            </span>
            <br />
            {guardianNames.join(" · ")}
          </p>
        )}
      </Card>

      {(athlete.hasMedicalInfo || athlete.hasCustodyRestrictions || athlete.mediaConsent) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {athlete.hasMedicalInfo && <HealthAlertBadge />}
          {athlete.hasCustodyRestrictions && <PickupRestrictionBadge />}
          <MediaStatusBadge status={athlete.mediaConsent?.status ?? null} />
        </div>
      )}

      <div className="mb-4">
        <EmergencyInfo athleteId={athlete.id} />
      </div>

      {/* Before they step on the court. Context, not performance data — the
          competitive meter in particular is personality and is never used for
          grouping or placement anywhere in this codebase. */}
      {(athlete.goal || coachingPrefs.length > 0 || meterLabel || athlete.parentCoachNote) && (
        <section className="mb-4">
          <SectionHeading>Know This Athlete</SectionHeading>
          <Card className="px-4 py-3.5">
            {athlete.goal && (
              <div className="mb-3">
                <Eyebrow className="text-gray-dark">Athlete Goal</Eyebrow>
                <p className="mt-0.5 font-body text-sm text-near-black">{athlete.goal}</p>
              </div>
            )}
            {coachingPrefs.length > 0 && (
              <div className="mb-3">
                <Eyebrow className="text-gray-dark">Coaching Style</Eyebrow>
                <div className="mt-1 flex flex-wrap gap-1">
                  {coachingPrefs.map((p) => (
                    <span
                      key={p}
                      className="rounded bg-warm-stone px-1.5 py-0.5 font-sport text-[10px] font-bold uppercase tracking-wide text-charcoal"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {meterLabel && (
              <div className="mb-3">
                <Eyebrow className="text-gray-dark">Competitive Meter</Eyebrow>
                <p className="mt-0.5 font-body text-sm text-near-black">{meterLabel}</p>
              </div>
            )}
            {athlete.parentCoachNote && (
              <div>
                <Eyebrow className="text-gray-dark">From Their Parent</Eyebrow>
                <p className="mt-0.5 font-body text-sm text-near-black">{athlete.parentCoachNote}</p>
              </div>
            )}
          </Card>
        </section>
      )}

      <section className="mb-4">
        <SectionHeading>Progress</SectionHeading>
        <Card>
          {reports.length === 0 ? (
            <p className="px-4 py-3.5 font-body text-sm text-gray-dark">
              No published reports yet.
            </p>
          ) : (
            reports.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="flex min-h-[48px] items-center justify-between gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0"
              >
                <span className="font-body text-sm text-near-black">{quarterLabel(r)}</span>
                <Pill tone="ok">Published</Pill>
              </div>
            ))
          )}
          <div className="border-t border-gray-mid px-4 py-3">
            <ActionLink href={`/coach/progress/new?athleteId=${athlete.id}`} variant="secondary">
              Create {quarterLabel(reportingQuarter())} Report
            </ActionLink>
          </div>
        </Card>
      </section>

      {athlete.teamMemberships.length > 0 && (
        <section className="mb-4">
          <SectionHeading>Team</SectionHeading>
          <Card>
            {athlete.teamMemberships.map((tm) => (
              <Link
                key={tm.team.id}
                href={`/coach/teams/${tm.team.id}`}
                className="flex min-h-[56px] items-center justify-between gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-heading text-sm font-bold text-near-black">
                    {tm.team.name}
                  </span>
                  <span className="block truncate font-body text-xs text-gray-dark">
                    {[tm.team.division, tm.team.program.name].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span aria-hidden="true" className="text-gray-dark">
                  ›
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-4">
          <SectionHeading>Coming Up</SectionHeading>
          <Card>
            {upcoming.map((b) => (
              <Link
                key={b.id}
                href={`/coach/sessions/${b.session.id}`}
                className="flex min-h-[56px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50"
              >
                <span className="w-[86px] shrink-0 font-sport text-xs font-bold uppercase text-charcoal">
                  {relativeDayLabel(b.session.startTime, now)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-sm text-near-black">
                    {b.session.program.name}
                  </span>
                  <span className="block font-body text-xs text-gray-dark">
                    {formatTime(b.session.startTime)}
                    {b.session.resource ? ` · ${b.session.resource.name}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      <section className="mb-4">
        <SectionHeading>Recent Attendance</SectionHeading>
        <Card>
          {recent.length === 0 ? (
            <p className="px-4 py-4 font-body text-sm text-gray-dark">No sessions yet.</p>
          ) : (
            recent.map((b) => {
              const status = b.attendance?.status;
              return (
                <div
                  key={b.id}
                  className="flex min-h-[48px] items-center justify-between gap-3 border-b border-gray-mid px-4 py-2 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-body text-sm text-near-black">
                      {b.session.program.name}
                    </span>
                    <span className="block font-body text-xs text-gray-dark">
                      {formatShortDate(b.session.startTime)}
                    </span>
                  </span>
                  <span className="shrink-0">
                    {status ? (
                      <Pill
                        tone={
                          status === "present" ? "ok" : status === "absent" ? "alert" : "neutral"
                        }
                      >
                        {ATTENDANCE_LABELS[status]}
                      </Pill>
                    ) : (
                      <Pill>Not marked</Pill>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <section className="mb-4">
        <SectionHeading>Development Notes</SectionHeading>
        <div className="mb-3">
          <NoteComposer
            athleteId={athlete.id}
            sessionId={sessionId}
            tags={tagsForSport(sportGuess)}
          />
        </div>

        {notes.length === 0 ? (
          <Card className="px-4 py-4">
            <p className="font-body text-sm text-gray-dark">
              No notes yet. A tag and one line is plenty.
            </p>
          </Card>
        ) : (
          <Card>
            {notes.map((n) => (
              <article key={n.id} className="border-b border-gray-mid px-4 py-3 last:border-b-0">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Eyebrow className="text-gray-dark">
                    {n.staff.name} · {formatShortDate(n.createdAt)}
                  </Eyebrow>
                  {n.visibility === "parent_shared" ? (
                    <Pill tone="accent">Shared with Parent</Pill>
                  ) : (
                    <Pill>Staff Only</Pill>
                  )}
                </div>
                {n.focus && (
                  <p className="font-body text-sm text-near-black">
                    <span className="font-sport text-[10px] uppercase text-gray-dark">Focus </span>
                    {n.focus}
                  </p>
                )}
                {n.workingOn && (
                  <p className="font-body text-sm text-near-black">
                    <span className="font-sport text-[10px] uppercase text-gray-dark">
                      Working On{" "}
                    </span>
                    {n.workingOn}
                  </p>
                )}
                {n.body && <p className="mt-1 font-body text-sm text-near-black">{n.body}</p>}
                {n.nextRecommendation && (
                  <p className="mt-1 font-body text-sm text-near-black">
                    <span className="font-sport text-[10px] uppercase text-gray-dark">Next </span>
                    {n.nextRecommendation}
                  </p>
                )}
                {n.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {n.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-warm-stone px-1.5 py-0.5 font-sport text-[10px] font-bold uppercase tracking-wide text-charcoal"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </Card>
        )}
      </section>

      <div className="flex flex-col gap-2 pb-2">
        <ActionLink href={`/coach/messages/new?familyId=${athlete.family.id}`} variant="secondary">
          Message This Family
        </ActionLink>
        {isLeadership(actor) && (
          <ActionLink href={`/coach/incidents/new?athleteId=${athlete.id}`} variant="secondary">
            Report an Incident
          </ActionLink>
        )}
      </div>
    </div>
  );
}
