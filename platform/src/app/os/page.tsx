import Link from "next/link";
import { getOsActor } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { QUICK_ACTIONS } from "@/lib/os/nav";
import { getAttentionItems } from "@/lib/os/attention";
import { dayMood, getTodaySessions, nextUp, summarize } from "@/lib/os/today";
import { dayLabel, pluralize } from "@/lib/os/format";
import { AttentionQueue } from "./_components/attention-queue";
import { SessionRow } from "./_components/session-row";
import { BTN, Card, CardHeader, EmptyState, Metric, PageHeader } from "./_components/ui";

// THE COURTS TODAY — the default landing screen.
//
// The rule this page is built to: everything on it is either something
// happening in the next few hours, or something a human has to go fix. No
// vanity metrics, no charts that don't change a decision.

export default async function TodayPage() {
  const actor = await getOsActor();
  const now = new Date();

  const [sessions, attention] = await Promise.all([
    can(actor, "schedule.view") ? getTodaySessions(actor, now) : Promise.resolve([]),
    getAttentionItems(actor),
  ]);

  const counts = summarize(sessions);
  const upcoming = nextUp(sessions, now);
  const quickActions = QUICK_ACTIONS.filter((a) => can(actor, a.capability));

  const criticalCount = attention.filter((i) => i.severity === "critical").length;

  return (
    <>
      <PageHeader
        eyebrow={dayLabel(now)}
        title="The Courts Today"
        subtitle={
          <span className="os-heading text-base text-orange-hover">{dayMood(counts)}</span>
        }
        actions={
          quickActions.length > 0 ? (
            <div className="hidden flex-wrap gap-2 sm:flex">
              {quickActions.slice(0, 2).map((a) => (
                <Link key={a.href} href={a.href} className={BTN.primary}>
                  + {a.label}
                </Link>
              ))}
            </div>
          ) : null
        }
      />

      {/* --- The numbers that decide what you do next ---------------------- */}
      {can(actor, "schedule.view") ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric
            label="Sessions"
            value={counts.sessionCount}
            detail={counts.cancelledCount > 0 ? `${counts.cancelledCount} cancelled` : "On the schedule"}
            href="/os/schedule"
          />
          <Metric
            label="Athletes Scheduled"
            value={counts.athletesScheduled}
            detail="Booked across today"
          />
          <Metric
            label="Coaches Working"
            value={counts.coachesWorking}
            detail="Assigned today"
            href="/os/coaches"
          />
          <Metric
            label="Open Spots Tonight"
            value={counts.openSpotsTonight}
            detail="4 PM onward"
            tone={counts.openSpotsTonight > 12 ? "warning" : undefined}
          />
          <Metric
            label="Needs Attention"
            value={attention.length}
            detail={criticalCount > 0 ? `${criticalCount} urgent` : "Nothing urgent"}
            tone={criticalCount > 0 ? "danger" : undefined}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Next up ---------------------------------------------------- */}
        {can(actor, "schedule.view") ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Next Up"
              action={
                <Link href="/os/schedule" className="os-eyebrow text-orange hover:underline">
                  Full Schedule →
                </Link>
              }
            />
            {upcoming.length === 0 ? (
              <EmptyState
                headline={sessions.length === 0 ? "Nothing on the Court." : "That's a Wrap."}
                detail={
                  sessions.length === 0
                    ? "No sessions are scheduled for today."
                    : `All ${pluralize(sessions.length, "session")} today have finished.`
                }
              />
            ) : (
              <ul className="divide-y divide-gray-mid">
                {upcoming.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {/* --- Needs attention -------------------------------------------- */}
        <Card>
          <CardHeader title="Needs Attention" count={attention.length} />
          <AttentionQueue items={attention} />
        </Card>
      </div>

      {/* --- Quick actions ------------------------------------------------ */}
      {quickActions.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Quick Actions" />
          <div className="flex flex-wrap gap-2 p-4">
            {quickActions.map((a) => (
              <Link key={a.href} href={a.href} className={BTN.secondary}>
                + {a.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
