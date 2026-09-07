import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { programTypeDef, gradeRangeLabel, OFFERING_STATUS_LABELS } from "@/lib/programs/types";
import { checkReadiness } from "@/lib/programs/publish";
import { formatCents } from "@/lib/programs/format";
import { expireStaleOffers } from "@/lib/programs/waitlist";
import { PageHeader, Card, Pill, type Tone } from "../../_components/ui";
import { DetailsSection } from "./details-section";
import { ScheduleSection } from "./schedule-section";
import { PricingSection } from "./pricing-section";
import { PublishSection } from "./publish-section";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  ready_to_publish: "info",
  published: "success",
  registration_closed: "warning",
  completed: "info",
  cancelled: "danger",
  archived: "neutral",
};

const TABS = [
  { key: "details", label: "Details" },
  { key: "schedule", label: "Schedule" },
  { key: "pricing", label: "Pricing" },
  { key: "publish", label: "Publish" },
] as const;

export default async function OfferingPage({ params, searchParams }: PageProps<"/os/offerings/[id]">) {
  const actor = await requireCapability("programs.view");
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "details";

  // Cheap and idempotent: a stale waitlist offer shouldn't keep holding a seat
  // just because no scheduled job has run.
  await expireStaleOffers();

  const offering = await prisma.offering.findUnique({
    where: { id },
    include: {
      program: true,
      requiredWaivers: { include: { waiver: { select: { id: true, waiverType: true, version: true } } } },
      sessions: {
        orderBy: { startTime: "asc" },
        include: {
          resource: { select: { id: true, name: true } },
          extraResources: { include: { resource: { select: { id: true, name: true } } } },
          coaches: { include: { staff: { select: { id: true, name: true } } } },
          _count: {
            select: {
              bookings: { where: { status: { not: "cancelled" } } },
              waitlistEntries: { where: { status: { in: ["waiting", "offered"] } } },
            },
          },
        },
      },
      scheduleChanges: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { changedBy: { select: { name: true } } },
      },
    },
  });

  if (!offering) notFound();

  const def = programTypeDef(offering.program.programType);
  const [resources, coaches, waivers, readiness] = await Promise.all([
    prisma.resource.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, resourceType: true },
    }),
    prisma.staffUser.findMany({
      where: { active: true, role: { in: ["coach", "head_coach", "admin", "owner"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, sports: true },
    }),
    prisma.waiver.findMany({ orderBy: { waiverType: "asc" }, select: { id: true, waiverType: true, version: true } }),
    checkReadiness(id),
  ]);

  const grades = gradeRangeLabel(offering.gradeMin, offering.gradeMax);
  const canEdit = can(actor, "programs.edit");
  const canPublish = can(actor, "programs.publish");

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <Link href="/os/programs" className="underline underline-offset-2">
              Programs
            </Link>
            {` · ${offering.program.sport ?? "General"} · ${def.label}`}
          </>
        }
        title={offering.name}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS_TONE[offering.status] ?? "neutral"}>
              {OFFERING_STATUS_LABELS[offering.status as keyof typeof OFFERING_STATUS_LABELS] ?? offering.status}
            </Pill>
            {offering.seasonLabel ? <span className="text-sm text-gray-dark">{offering.seasonLabel}</span> : null}
            {grades ? <span className="text-sm text-gray-dark">· {grades}</span> : null}
            <span className="text-sm text-gray-dark">· {formatCents(offering.priceCents)}</span>
            <span className="text-sm text-gray-dark">
              · {offering.sessions.filter((s) => s.status === "scheduled").length} session
              {offering.sessions.filter((s) => s.status === "scheduled").length === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <Link
            href={`/os/schedule?offering=${offering.id}`}
            className="os-heading inline-flex min-h-11 items-center rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black"
          >
            View on Schedule
          </Link>
        }
      />

      {/* Readiness banner. Always visible, on every tab — an admin should never
          have to go looking for why something can't go live. */}
      {readiness.blockers.length > 0 ? (
        <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger-bg p-4">
          <p className="os-eyebrow mb-2 text-danger">
            {readiness.blockers.length} thing{readiness.blockers.length === 1 ? "" : "s"} to fix before publishing
          </p>
          <ul className="flex flex-col gap-1 text-sm text-danger">
            {readiness.blockers.map((b, i) => (
              <li key={i}>· {b.label}</li>
            ))}
          </ul>
        </div>
      ) : offering.status === "draft" ? (
        <div role="status" className="mb-5 rounded-xl border border-success/30 bg-success-bg p-4">
          <p className="os-eyebrow text-success">Ready to publish</p>
          <p className="mt-1 text-sm text-success">
            Everything checks out. Open the Publish tab to review and go live.
          </p>
        </div>
      ) : null}

      {readiness.warnings.length > 0 ? (
        <div className="mb-5 rounded-xl border border-warning/30 bg-warning-bg p-4">
          <p className="os-eyebrow mb-2 text-warning">Worth a look</p>
          <ul className="flex flex-col gap-1 text-sm text-warning">
            {readiness.warnings.map((w, i) => (
              <li key={i}>· {w.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav aria-label="Builder sections" className="mb-5 flex flex-wrap gap-1.5 border-b border-gray-mid">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/os/offerings/${offering.id}?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`os-eyebrow -mb-px inline-flex min-h-11 items-center border-b-2 px-4 ${
                active
                  ? "border-orange text-orange"
                  : "border-transparent text-gray-dark hover:text-near-black"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "details" ? (
        <DetailsSection
          offering={JSON.parse(JSON.stringify(offering))}
          groups={def.groups}
          canEdit={canEdit}
          waivers={waivers}
        />
      ) : null}

      {tab === "schedule" ? (
        <ScheduleSection
          offeringId={offering.id}
          scheduleKind={offering.scheduleKind}
          defaultCapacity={offering.defaultSessionCapacity ?? def.defaults.capacity ?? 8}
          defaultDuration={def.defaults.durationMinutes ?? 60}
          resources={resources}
          coaches={coaches}
          sessions={JSON.parse(JSON.stringify(offering.sessions))}
          changes={JSON.parse(JSON.stringify(offering.scheduleChanges))}
          canEdit={can(actor, "schedule.edit")}
        />
      ) : null}

      {tab === "pricing" ? (
        <PricingSection
          offering={JSON.parse(JSON.stringify(offering))}
          canEdit={canEdit}
          canPublish={canPublish}
        />
      ) : null}

      {tab === "publish" ? (
        <PublishSection
          offering={JSON.parse(JSON.stringify(offering))}
          readiness={JSON.parse(JSON.stringify(readiness))}
          programTypeLabel={def.label}
          grades={grades}
          canPublish={canPublish}
        />
      ) : null}
    </div>
  );
}
