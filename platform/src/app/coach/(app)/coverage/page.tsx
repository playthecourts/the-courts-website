import { prisma } from "@/lib/prisma";
import { getCurrentCoach, isLeadership } from "@/lib/coach-dal";
import { formatLongDate, formatTimeRange } from "@/lib/coach-format";
import { PageTitle, Card, SectionHeading, Pill, EmptyState } from "@/components/coach/ui";
import { CancelCoverageButton, AssignCoverageForm } from "./coverage-controls";

// Fixes two real dangling links: the Today dashboard (coach-queries.ts) and
// requestCoverage() (sessions/actions.ts) have both pointed here since they
// shipped — this page never existed.

export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const actor = await getCurrentCoach();
  const leadership = isLeadership(actor);

  const [mine, assignedToMe, openQueueRaw] = await Promise.all([
    prisma.coverageRequest.findMany({
      where: { requestedById: actor.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { session: { include: { program: true } }, assignedTo: true },
    }),
    prisma.coverageRequest.findMany({
      where: { assignedToId: actor.id, status: "assigned" },
      orderBy: { session: { startTime: "asc" } },
      include: { session: { include: { program: true } }, requestedBy: true },
    }),
    leadership
      ? prisma.coverageRequest.findMany({
          where: {
            status: "open",
            ...(actor.isAdmin ? {} : { session: { program: { sport: { in: actor.scopedSports } } } }),
          },
          orderBy: { session: { startTime: "asc" } },
          include: { session: { include: { program: true } }, requestedBy: true },
        })
      : Promise.resolve([]),
  ]);

  // Candidates to cover a session: active coaches/head coaches/admin whose
  // sport matches (admin has no sport restriction), excluding whoever asked
  // for coverage in the first place.
  const openQueue = await Promise.all(
    openQueueRaw.map(async (r) => {
      const candidates = await prisma.staffUser.findMany({
        where: {
          active: true,
          role: { in: ["coach", "head_coach", "admin"] },
          id: { not: r.requestedById },
          OR: [{ role: "admin" }, { sports: { has: r.session.program.sport ?? "" } }],
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return { request: r, candidates };
    })
  );

  return (
    <div>
      <PageTitle eyebrow="Staffing">Coverage</PageTitle>

      {leadership && (
        <div className="mb-6">
          <SectionHeading>Open — Needs a Coach</SectionHeading>
          {openQueue.length === 0 ? (
            <EmptyState title="Nothing Open" body="No coverage requests need an answer right now." />
          ) : (
            <div className="flex flex-col gap-3">
              {openQueue.map(({ request: r, candidates }) => (
                <Card key={r.id} className="p-4">
                  <p className="font-heading text-[15px] font-bold text-near-black">{r.session.program.name}</p>
                  <p className="mt-0.5 font-body text-sm text-gray-dark">
                    {formatLongDate(r.session.startTime)} · {formatTimeRange(r.session.startTime, r.session.endTime)}
                  </p>
                  <p className="mt-1 font-body text-[13px] text-gray-dark">
                    Requested by {r.requestedBy.name}
                    {r.reason ? ` — ${r.reason}` : ""}
                  </p>
                  {candidates.length > 0 ? (
                    <div className="mt-3">
                      <AssignCoverageForm requestId={r.id} candidates={candidates} />
                    </div>
                  ) : (
                    <p className="mt-3 font-body text-[13px] text-gray-dark">No active coach available for this sport.</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <SectionHeading>Assigned to Me</SectionHeading>
        {assignedToMe.length === 0 ? (
          <EmptyState title="Nothing Assigned" body="No coverage sessions have been assigned to you." />
        ) : (
          <div className="flex flex-col gap-3">
            {assignedToMe.map((r) => (
              <Card key={r.id} className="p-4">
                <p className="font-heading text-[15px] font-bold text-near-black">{r.session.program.name}</p>
                <p className="mt-0.5 font-body text-sm text-gray-dark">
                  {formatLongDate(r.session.startTime)} · {formatTimeRange(r.session.startTime, r.session.endTime)}
                </p>
                <p className="mt-1 font-body text-[13px] text-gray-dark">Covering for {r.requestedBy.name}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeading>My Requests</SectionHeading>
        {mine.length === 0 ? (
          <EmptyState title="Nothing Requested" body="Request coverage from a session's detail page when you can't make it." />
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-[15px] font-bold text-near-black">{r.session.program.name}</p>
                    <p className="mt-0.5 font-body text-sm text-gray-dark">
                      {formatLongDate(r.session.startTime)} · {formatTimeRange(r.session.startTime, r.session.endTime)}
                    </p>
                  </div>
                  <Pill tone={r.status === "open" ? "warn" : r.status === "assigned" ? "ok" : "neutral"}>
                    {r.status === "open" ? "Open" : r.status === "assigned" ? `Covered by ${r.assignedTo?.name ?? "—"}` : "Cancelled"}
                  </Pill>
                </div>
                {r.status === "open" && (
                  <div className="mt-3">
                    <CancelCoverageButton requestId={r.id} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
