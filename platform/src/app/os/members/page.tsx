import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { FOUNDING_OFFER } from "@/lib/founding-offer";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Metric, TableWrap, Th, Td } from "../_components/ui";

export const dynamic = "force-dynamic";

// Everyone with a membership, in one list: who they are, what they're on,
// what they pay and when they're billed next. Segments are how Melissa
// talks about members, not how the schema stores them:
//   NextGen Founders  — current NextGen families carried over on the legacy rate
//   Former Members    — former NextGen families on the Formers rate
//   Founding 10       — non-NextGen families who started Unlimited on opening
//                       day (Oct 1, 2026) at the $185 founding rate
//   New to The Courts — everyone else
//   Comp              — staff/owner comp memberships

type Segment = "nextgen" | "former" | "founding" | "new" | "comp";

const SEGMENT_LABEL: Record<Segment, string> = {
  nextgen: "NextGen Founders",
  former: "Former Members",
  founding: "Founding 10",
  new: "New to The Courts",
  comp: "Comp",
};
const SEGMENT_TONE: Record<Segment, "warning" | "info" | "brand" | "success" | "neutral"> = {
  nextgen: "warning",
  former: "info",
  founding: "brand",
  new: "success",
  comp: "neutral",
};

const TYPE_LABEL: Record<string, string> = {
  "Weekly Membership": "Weekly",
  "Unlimited Membership": "Unlimited",
  "Full Court Membership": "Full Court",
  "Family Unlimited Membership": "Family Unlimited",
  "NextGen Legacy Rate": "NextGen Legacy",
  "NextGen Formers Membership": "NextGen Formers",
  "Owner Comp Membership": "Owner Comp",
};

const OPENING_DAY = FOUNDING_OFFER.opensAt.toISOString().slice(0, 10); // 2026-10-01

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
// Membership dates are calendar dates (@db.Date), so read them in UTC.
const day = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("families.view");
  const sp = await searchParams;
  const segFilter = typeof sp.segment === "string" ? (sp.segment as Segment) : "";
  const typeFilter = typeof sp.type === "string" ? sp.type : "";
  const statusFilter = sp.status === "cancelled" ? "cancelled" : sp.status === "all" ? "all" : "current";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const memberships = await prisma.athleteMembership.findMany({
    where:
      statusFilter === "current"
        ? { status: { in: ["active", "past_due", "paused"] } }
        : statusFilter === "cancelled"
          ? { status: "cancelled" }
          : {},
    include: {
      plan: { select: { name: true, priceCents: true } },
      athlete: {
        select: {
          firstName: true,
          lastName: true,
          grade: true,
          familyId: true,
          family: {
            select: {
              guardians: {
                orderBy: { isPrimary: "desc" },
                select: {
                  guardian: {
                    select: { id: true, name: true, email: true, phone: true, nextGenStatus: true, legacyRateCents: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ renewalDate: "asc" }, { startDate: "asc" }],
  });

  const rows = memberships.map((m) => {
    const guardian = m.athlete.family.guardians[0]?.guardian ?? null;
    const planName = m.plan.name;
    const startedOpeningDay = m.startDate.toISOString().slice(0, 10) === OPENING_DAY;
    let segment: Segment;
    if (planName === "Owner Comp Membership") segment = "comp";
    else if (planName === "NextGen Legacy Rate" || guardian?.nextGenStatus === "current_nextgen") segment = "nextgen";
    else if (planName === "NextGen Formers Membership" || guardian?.nextGenStatus === "former_nextgen") segment = "former";
    else if (planName === FOUNDING_OFFER.planName && startedOpeningDay) segment = "founding";
    else segment = "new";

    const rateCents =
      planName === "NextGen Legacy Rate"
        ? (guardian?.legacyRateCents ?? 0)
        : segment === "founding"
          ? FOUNDING_OFFER.rateCents
          : m.plan.priceCents;

    return {
      id: m.id,
      athlete: `${m.athlete.firstName} ${m.athlete.lastName}`,
      grade: m.athlete.grade,
      familyId: m.athlete.familyId,
      guardian,
      segment,
      type: TYPE_LABEL[planName] ?? planName.replace(/\s+Membership$/, ""),
      rateCents,
      status: m.status,
      startDate: m.startDate,
      nextBilling: m.renewalDate,
      cancelAt: m.cancelAt,
    };
  });

  const types = [...new Set(rows.map((r) => r.type))].sort();
  const visible = rows.filter(
    (r) =>
      (!segFilter || r.segment === segFilter) &&
      (!typeFilter || r.type === typeFilter) &&
      (!q ||
        r.athlete.toLowerCase().includes(q) ||
        (r.guardian?.name ?? "").toLowerCase().includes(q) ||
        (r.guardian?.email ?? "").toLowerCase().includes(q))
  );

  const countBy = (s: Segment) => rows.filter((r) => r.segment === s && r.status !== "cancelled").length;
  const monthly = rows.filter((r) => r.status === "active").reduce((n, r) => n + r.rateCents, 0);
  const hasFilters = Boolean(segFilter || typeFilter || q || statusFilter !== "current");

  const segLink = (s: Segment | "") => {
    const p = new URLSearchParams();
    if (s) p.set("segment", s);
    if (typeFilter) p.set("type", typeFilter);
    if (statusFilter !== "current") p.set("status", statusFilter);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/os/members${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Members"
        subtitle="Everyone with a membership — what they're on, what they pay, and when they're billed next."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Active members" value={rows.filter((r) => r.status === "active").length} href={segLink("")} />
        <Metric label="NextGen Founders" value={countBy("nextgen")} href={segLink("nextgen")} />
        <Metric label="Former Members" value={countBy("former")} href={segLink("former")} />
        <Metric label="Comped" value={countBy("comp")} href={segLink("comp")} />
        <Metric label="New to The Courts" value={countBy("new")} href={segLink("new")} />
        <Metric label="Monthly (active)" value={money(monthly)} detail="At each member's current rate" />
      </div>

      <form method="get" action="/os/members" className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="q" className="os-eyebrow mb-1.5 block text-gray-dark">Search</label>
          <input
            id="q" name="q" defaultValue={q} placeholder="Athlete, parent or email…"
            className="min-h-11 w-56 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="segment" className="os-eyebrow mb-1.5 block text-gray-dark">Member group</label>
          <select id="segment" name="segment" defaultValue={segFilter} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">All groups</option>
            {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => (
              <option key={s} value={s}>{SEGMENT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="os-eyebrow mb-1.5 block text-gray-dark">Membership type</label>
          <select id="type" name="type" defaultValue={typeFilter} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="os-eyebrow mb-1.5 block text-gray-dark">Status</label>
          <select id="status" name="status" defaultValue={statusFilter} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="current">Current</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>
        <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
          Apply
        </button>
        {hasFilters ? (
          <Link href="/os/members" className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">
            Clear
          </Link>
        ) : null}
      </form>

      <Card>
        <CardHeader title={segFilter ? SEGMENT_LABEL[segFilter] ?? "Members" : "Members"} count={visible.length} />
        {visible.length === 0 ? (
          <EmptyState headline="No members match." detail="Try a different group, type or status." />
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>Parent</Th>
                  <Th>Group</Th>
                  <Th>Membership</Th>
                  <Th>Rate</Th>
                  <Th>Next Billing</Th>
                  <Th>Member Since</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="font-medium text-near-black">{r.athlete}</span>
                      {r.grade ? <span className="ml-1.5 text-neutral">· {r.grade}</span> : null}
                    </Td>
                    <Td>
                      {r.guardian ? (
                        <Link href={`/os/families/${r.familyId}`} className="text-near-black hover:underline">{r.guardian.name}</Link>
                      ) : (
                        <Link href={`/os/families/${r.familyId}`} className="text-near-black hover:underline">View family</Link>
                      )}
                      <br />
                      <span className="text-neutral">{r.guardian?.email ?? ""}</span>
                    </Td>
                    <Td><Pill tone={SEGMENT_TONE[r.segment]}>{SEGMENT_LABEL[r.segment]}</Pill></Td>
                    <Td className="text-near-black">{r.type}</Td>
                    <Td className="os-num text-near-black">{r.rateCents ? `${money(r.rateCents)}/mo` : "Free"}</Td>
                    <Td className="text-near-black">
                      {r.cancelAt ? <span className="text-danger">Ends {day(r.cancelAt)}</span> : day(r.nextBilling)}
                    </Td>
                    <Td className="text-neutral">{day(r.startDate)}</Td>
                    <Td>
                      <Pill tone={r.status === "active" ? "success" : r.status === "past_due" ? "danger" : "neutral"}>
                        {r.status === "past_due" ? "Payment failed" : r.status}
                      </Pill>
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
