import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { scopedSports } from "@/lib/os/permissions";
import { PROGRAM_TYPE_LABELS, gradeRangeLabel } from "@/lib/programs/types";
import { PageHeader, Card, CardHeader, EmptyState, ButtonLink, Pill } from "../../_components/ui";

export const dynamic = "force-dynamic";

// A session cannot exist on its own — it belongs to an Offering, which is what
// gives it a price, an eligibility rule and somewhere to publish. So "Add
// Session" asks which programme it's for rather than creating an orphan the
// rest of the system can't reason about.

export default async function AddSessionPage() {
  const actor = await requireCapability("schedule.edit");
  const sports = scopedSports(actor);

  const offerings = await prisma.offering.findMany({
    where: {
      status: { notIn: ["archived", "completed", "cancelled"] },
      ...(sports && sports.length > 0 ? { program: { sport: { in: sports } } } : {}),
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 60,
    select: {
      id: true, name: true, seasonLabel: true, status: true,
      gradeMin: true, gradeMax: true,
      program: { select: { sport: true, programType: true } },
      _count: { select: { sessions: { where: { status: "scheduled" } } } },
    },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow={<Link href="/os/schedule" className="underline underline-offset-2">Schedule</Link>}
        title="Add sessions"
        subtitle="Pick the program these sessions belong to. You'll set the pattern, courts and staffing on the next screen — and see exactly what gets created before anything is."
        actions={<ButtonLink href="/os/programs/new" variant="primary">+ Create Something New</ButtonLink>}
      />

      <Card>
        <CardHeader title="Active programs" count={offerings.length} />
        {offerings.length === 0 ? (
          <EmptyState
            headline="Nothing to add sessions to yet."
            detail="Sessions belong to a program. Create one first and the scheduler follows."
            action={<ButtonLink href="/os/programs/new" variant="primary">+ Create Something</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {offerings.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/os/offerings/${o.id}?tab=schedule`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-warm-white"
                >
                  <div className="min-w-0">
                    <p className="os-heading text-sm text-near-black">
                      {o.name}
                      {o.seasonLabel ? <span className="ml-2 font-normal text-neutral">{o.seasonLabel}</span> : null}
                    </p>
                    <p className="text-xs text-neutral">
                      {[
                        o.program.sport,
                        PROGRAM_TYPE_LABELS[o.program.programType],
                        gradeRangeLabel(o.gradeMin, o.gradeMax),
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="os-num text-sm text-gray-dark">
                      {o._count.sessions} session{o._count.sessions === 1 ? "" : "s"}
                    </span>
                    {o.status !== "published" ? (
                      <Pill tone="neutral">{o.status.replace(/_/g, " ")}</Pill>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
