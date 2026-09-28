import { prisma } from "@/lib/prisma";
import { getCurrentCoach } from "@/lib/coach-dal";
import { formatShortDate, startOfDay } from "@/lib/coach-format";
import { PageTitle, Card, SectionHeading, EmptyState } from "@/components/coach/ui";
import { RequestTimeOffForm, CancelTimeOffButton } from "./time-off-controls";

export const dynamic = "force-dynamic";

type Row = { id: string; specificDate: Date; note: string | null };

/// Consecutive dates with the same note collapse into one visual block —
/// each row is still its own CoachAvailability record underneath (see
/// actions.ts), this is purely a display grouping.
function groupBlocks(rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a.specificDate.getTime() - b.specificDate.getTime());
  const blocks: { ids: string[]; start: Date; end: Date; note: string | null }[] = [];
  for (const r of sorted) {
    const last = blocks[blocks.length - 1];
    const oneDayAfter = last ? last.end.getTime() + 86_400_000 : null;
    if (last && last.note === r.note && oneDayAfter === r.specificDate.getTime()) {
      last.ids.push(r.id);
      last.end = r.specificDate;
    } else {
      blocks.push({ ids: [r.id], start: r.specificDate, end: r.specificDate, note: r.note });
    }
  }
  return blocks;
}

export default async function TimeOffPage() {
  const actor = await getCurrentCoach();

  const rawRows = await prisma.coachAvailability.findMany({
    where: { staffUserId: actor.id, status: "unavailable", specificDate: { gte: startOfDay(new Date()) } },
    select: { id: true, specificDate: true, note: true },
  });
  // The where clause guarantees specificDate is set (this page only ever
  // writes/reads specific-date rows, never the weekday-recurring kind), but
  // the field is nullable in the schema so Prisma can't narrow the type.
  const rows: Row[] = rawRows.filter((r): r is Row => r.specificDate !== null).map((r) => ({ ...r, specificDate: r.specificDate! }));
  const blocks = groupBlocks(rows);

  return (
    <div>
      <PageTitle eyebrow="Staffing" sub="Days you mark off here show up as a heads-up wherever staff builds the schedule.">
        Time Off
      </PageTitle>

      <div className="mb-6">
        <SectionHeading>Request Time Off</SectionHeading>
        <Card className="p-4">
          <RequestTimeOffForm />
        </Card>
      </div>

      <div>
        <SectionHeading>Upcoming</SectionHeading>
        {blocks.length === 0 ? (
          <EmptyState title="Nothing Scheduled Off" body="Any time off you request will show up here." />
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((b) => (
              <Card key={b.ids[0]} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-heading text-[15px] font-bold text-near-black">
                    {b.start.getTime() === b.end.getTime()
                      ? formatShortDate(b.start)
                      : `${formatShortDate(b.start)} – ${formatShortDate(b.end)}`}
                  </p>
                  {b.note && <p className="mt-0.5 font-body text-[13px] text-gray-dark">{b.note}</p>}
                </div>
                <CancelTimeOffButton ids={b.ids} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
