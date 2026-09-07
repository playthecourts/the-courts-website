import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/os/permissions";
import { PageHeader, Card, CardHeader, EmptyState, Pill, ButtonLink } from "../_components/ui";
import { BlockForm } from "./block-form";
import { RemoveBlockButton } from "./remove-block-button";

export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(d);

export default async function FacilityPage() {
  const actor = await requireCapability("facility.view");
  const now = new Date();

  const [resources, blocks] = await Promise.all([
    prisma.resource.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { sessions: { where: { status: "scheduled", startTime: { gte: now } } } } },
      },
    }),
    prisma.facilityBlock.findMany({
      where: { endTime: { gte: now } },
      orderBy: { startTime: "asc" },
      include: { resource: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
  ]);

  const canBlock = can(actor, "facility.block");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Facility"
        title="Courts + Closures"
        subtitle="What can be booked, and when it can't be."
        actions={<ButtonLink href="/os/schedule">View Schedule</ButtonLink>}
      />

      <Card>
        <CardHeader title="Resources" count={resources.length} />
        {resources.length === 0 ? (
          <EmptyState headline="No resources yet." detail="Courts and equipment are configured here, not hard-coded." />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {resources.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="os-heading text-sm text-near-black">{r.name}</p>
                  <p className="text-xs text-neutral">
                    {r.resourceType.replace(/_/g, " ")}
                    {r.overlapsResourceIds.length > 0
                      ? ` · overlaps ${r.overlapsResourceIds.length} other resource${r.overlapsResourceIds.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="os-num text-sm text-gray-dark">{r._count.sessions} upcoming</span>
                  <Pill tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Upcoming closures" count={blocks.length} />
        {blocks.length === 0 ? (
          <EmptyState
            headline="Nothing blocked."
            detail="Holidays, maintenance and private events go here — the scheduler refuses to book into them."
          />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="os-heading text-sm text-near-black">
                    {b.resource?.name ?? "Whole facility"}
                  </p>
                  <p className="text-xs text-neutral">
                    {fmt(b.startTime)} – {fmt(b.endTime)} · {b.reason.replace(/_/g, " ")}
                    {b.note ? ` · ${b.note}` : ""}
                    {b.createdBy ? ` · ${b.createdBy.name}` : ""}
                  </p>
                </div>
                {canBlock ? <RemoveBlockButton blockId={b.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canBlock ? (
        <Card>
          <div id="block" style={{ scrollMarginTop: "1rem" }} />
          <CardHeader title="Block a court or the facility" />
          <div className="p-4">
            <BlockForm resources={resources.map((r) => ({ id: r.id, name: r.name }))} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
