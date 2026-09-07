import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCapability, athleteScope } from "@/lib/os/dal";
import { scopedSports } from "@/lib/os/permissions";
import { quarterLabel, reportingQuarter, quarterRange, type Quarter } from "@/lib/quarters";
import { minSessionsForReport } from "@/lib/progress-metrics";
import { fullName } from "@/lib/athlete";
import { PageHeader, Card, CardHeader, Pill, EmptyState, TableWrap, Th, Td } from "../_components/ui";

export const dynamic = "force-dynamic";

// Quarterly progress management.
//
// The number that matters here is not "how many reports exist" but "how many
// athletes are eligible and still unwritten" — the queue. The fourth bucket,
// insufficient participation, is deliberately visible: it stops a head coach
// chasing a coach for a report that should never be written.

const STATUS_TONE = { draft: "neutral", ready_for_review: "warning", published: "success" } as const;

const FILTERS = [
  { key: "", label: "All" },
  { key: "published", label: "Published" },
  { key: "ready_for_review", label: "Awaiting Review" },
  { key: "draft", label: "Draft" },
  { key: "none", label: "Not Started" },
  { key: "ineligible", label: "Not Enough Participation" },
] as const;

export default async function OsProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; status?: string }>;
}) {
  const actor = await requireCapability("athletes.view");
  const sp = await searchParams;

  const current = reportingQuarter();
  const q: Quarter = sp.q
    ? { year: Number(sp.q.split("Q")[0]), quarter: Number(sp.q.split("Q")[1]) }
    : current;
  const sportFilter = sp.sport ?? null;
  const statusFilter = sp.status ?? "";

  const { start, end } = quarterRange(q);
  const minimum = minSessionsForReport();
  const allowedSports = scopedSports(actor);

  // "Eligible" is defined by attendance in the quarter, so the candidate list
  // starts from athletes who were actually in the building — not from every
  // athlete on file.
  const athletes = await prisma.athlete.findMany({
    where: {
      AND: [
        athleteScope(actor),
        sportFilter ? { sports: { has: sportFilter } } : {},
        {
          bookings: {
            some: {
              status: { not: "cancelled" },
              attendance: { status: { in: ["present", "late"] } },
              session: { startTime: { gte: start, lt: end } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      sports: true,
      progressReports: {
        where: { year: q.year, quarter: q.quarter },
        select: { id: true, status: true, sport: true },
      },
      _count: {
        select: {
          bookings: {
            where: {
              status: { not: "cancelled" },
              attendance: { status: { in: ["present", "late"] } },
              session: { startTime: { gte: start, lt: end } },
            },
          },
        },
      },
    },
    orderBy: { lastName: "asc" },
  });

  const rows = athletes.map((a) => {
    const sessions = a._count.bookings;
    const report = a.progressReports[0] ?? null;
    const eligible = sessions >= minimum;
    const bucket = !eligible ? "ineligible" : (report?.status ?? "none");
    return { athlete: a, sessions, report, eligible, bucket };
  });

  const counts = {
    eligible: rows.filter((r) => r.eligible).length,
    published: rows.filter((r) => r.bucket === "published").length,
    draft: rows.filter((r) => r.bucket === "draft" || r.bucket === "ready_for_review").length,
    ineligible: rows.filter((r) => r.bucket === "ineligible").length,
  };

  const visible = statusFilter ? rows.filter((r) => r.bucket === statusFilter) : rows;

  const sportOptions = allowedSports ?? ["Basketball", "Volleyball"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Progress"
        title={`${quarterLabel(q)} Progress Reports`}
        subtitle={`${counts.eligible} eligible · ${counts.published} published · ${counts.draft} in progress · ${counts.ineligible} not enough participation`}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          params.set("q", `${q.year}Q${q.quarter}`);
          if (sportFilter) params.set("sport", sportFilter);
          if (f.key) params.set("status", f.key);
          const active = statusFilter === f.key;
          return (
            <Link
              key={f.key}
              href={`/os/progress?${params.toString()}`}
              className={`flex min-h-[38px] items-center rounded-full border px-3.5 font-sport text-[11px] font-bold uppercase tracking-[0.1em] ${
                active
                  ? "border-orange bg-orange text-white"
                  : "border-gray-mid bg-white text-gray-dark hover:border-orange"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {[null, ...sportOptions].map((s) => {
          const params = new URLSearchParams();
          params.set("q", `${q.year}Q${q.quarter}`);
          if (s) params.set("sport", s);
          if (statusFilter) params.set("status", statusFilter);
          const active = sportFilter === s;
          return (
            <Link
              key={s ?? "all"}
              href={`/os/progress?${params.toString()}`}
              className={`flex min-h-[34px] items-center rounded-full border px-3 font-body text-[13px] ${
                active ? "border-near-black bg-near-black text-white" : "border-gray-mid bg-white text-gray-dark"
              }`}
            >
              {s ?? "All Sports"}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Athletes" />
        {visible.length === 0 ? (
          <EmptyState
            headline="Nothing in this bucket"
            detail="Try another filter, or a different quarter."
          />
        ) : (
          <TableWrap>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>Sport</Th>
                  <Th>Sessions</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.athlete.id}>
                    <Td>
                      <Link href={`/os/athletes/${r.athlete.id}`} className="underline">
                        {fullName(r.athlete)}
                      </Link>
                    </Td>
                    <Td>{r.athlete.sports.join(" · ") || "—"}</Td>
                    <Td className="tabular-nums">{r.sessions}</Td>
                    <Td>
                      {r.bucket === "ineligible" ? (
                        <Pill tone="neutral">Not enough court time</Pill>
                      ) : r.report ? (
                        <Link href={`/coach/progress/${r.report.id}`}>
                          <Pill tone={STATUS_TONE[r.report.status]}>
                            {r.report.status.replace(/_/g, " ")}
                          </Pill>
                        </Link>
                      ) : (
                        <Link href={`/coach/progress/new?athleteId=${r.athlete.id}`}>
                          <Pill tone="warning">Not started</Pill>
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
