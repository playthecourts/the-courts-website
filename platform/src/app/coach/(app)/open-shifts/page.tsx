import { prisma } from "@/lib/prisma";
import { getCurrentCoach } from "@/lib/coach-dal";
import { formatLongDate, formatTimeRange } from "@/lib/coach-format";
import { PageTitle, Card, EmptyState } from "@/components/coach/ui";
import { ClaimShiftButton } from "./open-shifts-controls";

export const dynamic = "force-dynamic";

export default async function OpenShiftsPage() {
  const actor = await getCurrentCoach();

  // Same sport-scoping doc comment on StaffUser.sports flags as unused for
  // a plain coach today — this is the real use for it: browse/claim is
  // naturally limited to sports you actually coach. Admin sees everything.
  const sports = actor.sports;

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { gte: new Date() },
      coaches: { none: {} },
      ...(actor.isAdmin || sports.length === 0 ? {} : { program: { sport: { in: sports } } }),
    },
    orderBy: { startTime: "asc" },
    take: 40,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      program: { select: { name: true, sport: true } },
      resource: { select: { name: true } },
    },
  });

  return (
    <div>
      <PageTitle eyebrow="Staffing" sub="Sessions with no coach assigned yet — claim one to be added.">
        Open Shifts
      </PageTitle>

      {sessions.length === 0 ? (
        <EmptyState title="Nothing Open" body="No unstaffed sessions right now — check back later." />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-heading text-[15px] font-bold text-near-black">{s.program.name}</p>
                <p className="mt-0.5 font-body text-sm text-gray-dark">
                  {formatLongDate(s.startTime)} · {formatTimeRange(s.startTime, s.endTime)}
                </p>
                {s.resource && <p className="mt-0.5 font-body text-[13px] text-gray-dark">{s.resource.name}</p>}
              </div>
              <ClaimShiftButton sessionId={s.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
