import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability, assertFamilyAccess } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { loadFamilyDetail } from "@/lib/os/family-detail";
import { ageFrom } from "@/lib/athlete";
import { formatGrade } from "@/lib/coach-format";
import { money, moneyExact, pluralize } from "@/lib/os/format";
import { MediaStatusBadge } from "@/components/athlete/badges";
import { PageHeader, Card, CardHeader, EmptyState, Metric, Pill, TableWrap, Th, Td } from "../../_components/ui";
import { OwedActions, BillingDateForm } from "../../payments/row-actions";

export const dynamic = "force-dynamic";

// One household on one page: the adults, the kids, what they're on and pay,
// what's owed, what's coming up and what just happened. Every section a role
// can't hold is simply not rendered — same rule as the athlete record.

// Class times and Date-only columns are wall-clock (UTC); createdAt and
// registeredAt are real timestamps, shown in Central.
const wallDay = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
const wallDayTime = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
const centralDay = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }).format(d);
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const MEMBERSHIP_TONE = { active: "success", past_due: "danger", paused: "neutral", cancelled: "neutral" } as const;
const MEMBERSHIP_LABEL = { active: "Active", past_due: "Payment failed", paused: "Paused", cancelled: "Cancelled" } as const;

const NEXTGEN_LABEL: Record<string, string> = {
  current_nextgen: "NextGen: Current",
  former_nextgen: "NextGen: Former",
};

function attendanceLabel(attendance: string | null, bookingStatus: string): string {
  if (attendance === "present" || attendance === "late") return "Here";
  if (attendance === "absent") return "No show";
  if (attendance === "excused") return "Excused";
  if (bookingStatus === "attended") return "Here";
  if (bookingStatus === "no_show") return "No show";
  return "—";
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-gray-mid px-4 py-3 first:border-t-0">{children}</div>;
}

export default async function OsFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireCapability("families.view");
  await assertFamilyAccess(actor, id);

  const data = await loadFamilyDetail(actor, id);
  if (!data) notFound();

  const seeSensitive = can(actor, "families.viewSensitive");
  const seeCustody = can(actor, "athletes.viewCustody");
  const seePayments = can(actor, "payments.view");
  const canSendLink = can(actor, "payments.sendLink");
  const canMoveDates = can(actor, "plans.manage");

  const active = data.athletes.filter((a) => !a.archivedAt);
  const archived = data.athletes.filter((a) => a.archivedAt);
  const missingCount = active.reduce((n, a) => n + (data.missingWaivers.get(a.id)?.length ?? 0), 0);
  const since = data.memberSince.isCalendarDate ? wallDay(data.memberSince.date) : centralDay(data.memberSince.date);

  return (
    <div>
      <PageHeader
        eyebrow="Family"
        title={data.family.name}
        subtitle={`${pluralize(active.length, "athlete")} · member since ${since}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Monthly" value={money(data.monthlyCents)} detail="Active memberships, at each kid's rate" />
        {seePayments ? (
          <Metric
            label="Owed"
            value={moneyExact(data.owedTotalCents)}
            detail={pluralize(data.owed.length, "item")}
            tone={data.owed.length ? "warning" : undefined}
          />
        ) : null}
        <Metric label="Upcoming Classes" value={data.upcomingCount} detail="Booked from now on" />
        <Metric
          label="Waivers"
          value={missingCount === 0 ? "All signed" : `${missingCount} missing`}
          tone={missingCount ? "danger" : undefined}
        />
      </div>

      <div className="flex flex-col gap-5">
        <Card as="section">
          <CardHeader title="Parents & Guardians" count={data.guardians.length} />
          {data.guardians.length === 0 ? (
            <EmptyState headline="No adults on file." detail="This family has no guardians linked to it." />
          ) : (
            data.guardians.map((fg) => (
              <Row key={fg.guardianId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body text-[14.5px] font-medium text-near-black">
                      {fg.guardian.name}
                      {fg.relationship ? <span className="font-normal text-gray-dark"> · {fg.relationship}</span> : null}
                    </p>
                    {seeSensitive ? (
                      <p className="mt-0.5 text-sm text-gray-dark">
                        {[
                          fg.guardian.email ? (
                            <a key="em" href={`mailto:${fg.guardian.email}`} className="hover:underline">{fg.guardian.email}</a>
                          ) : null,
                          fg.guardian.phone ? (
                            <a key="ph" href={`tel:${fg.guardian.phone}`} className="os-num hover:underline">{fg.guardian.phone}</a>
                          ) : null,
                        ]
                          .filter(Boolean)
                          .map((x, i) => <span key={i}>{i ? " · " : ""}{x}</span>)}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-gray-dark">
                      Pickup: {fg.authorizedForPickup ? "yes" : "no"} · {fg.guardian.authId ? "Has an account" : "No login yet"}
                    </p>
                    {seePayments && fg.guardian.stripeCustomerId ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${fg.guardian.stripeCustomerId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="os-eyebrow mt-1 inline-block text-orange underline underline-offset-2"
                      >
                        Open in Stripe
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fg.isPrimary ? <Pill tone="brand">Primary</Pill> : null}
                    {fg.guardian.nextGenStatus ? (
                      <Pill tone={fg.guardian.nextGenStatus === "current_nextgen" ? "warning" : "info"}>
                        {NEXTGEN_LABEL[fg.guardian.nextGenStatus] ?? fg.guardian.nextGenStatus}
                      </Pill>
                    ) : null}
                  </div>
                </div>
              </Row>
            ))
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Athletes" count={active.length} />
          {active.length === 0 ? (
            <EmptyState headline="No athletes yet." detail="Nobody has been added to this family." />
          ) : (
            active.map((a) => {
              const missing = data.missingWaivers.get(a.id) ?? [];
              return (
                <Row key={a.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/os/athletes/${a.id}`} className="font-body text-[14.5px] font-medium text-near-black hover:underline">
                        {a.nickname?.trim() || a.firstName} {a.lastName}
                      </Link>
                      <p className="text-xs text-gray-dark">
                        {[formatGrade(a.grade), `Age ${ageFrom(a.dob)}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <MediaStatusBadge status={a.mediaConsent?.status ?? null} />
                      {a.hasMedicalInfo ? <Pill tone="warning">Health Info</Pill> : null}
                      {a.hasCustodyRestrictions && seeCustody ? <Pill tone="danger">Custody Restriction</Pill> : null}
                      {a.hasCustodyRestrictions && !seeCustody && seeSensitive ? <Pill tone="neutral">Pickup restriction</Pill> : null}
                      {missing.length > 0 ? <Pill tone="warning">Waivers missing</Pill> : null}
                    </div>
                  </div>
                </Row>
              );
            })
          )}
          {archived.length > 0 ? (
            <p className="border-t border-gray-mid px-4 py-2.5 text-xs text-neutral">
              Archived: {archived.map((a) => `${a.nickname?.trim() || a.firstName} ${a.lastName}`).join(", ")}
            </p>
          ) : null}
        </Card>

        <Card as="section">
          <CardHeader title="Memberships" count={data.memberships.length} />
          {data.memberships.length === 0 ? (
            <EmptyState headline="No memberships." detail="Nobody in this family is on a membership right now." />
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Athlete</Th><Th>Plan</Th><Th>Status</Th><Th>Rate</Th><Th>Next Charge</Th>
                    {canMoveDates ? <Th>Move Next Charge</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {data.memberships.map((m) => (
                    <tr key={m.id} className="align-top">
                      <Td>
                        <Link href={`/os/athletes/${m.athleteId}`} className="font-medium text-near-black hover:underline">{m.athlete}</Link>
                      </Td>
                      <Td className="text-near-black">{m.plan}</Td>
                      <Td><Pill tone={MEMBERSHIP_TONE[m.status]}>{MEMBERSHIP_LABEL[m.status]}</Pill></Td>
                      <Td className="os-num text-near-black">{m.rateCents ? `${money(m.rateCents)}/mo` : "Free"}</Td>
                      <Td className="os-num text-near-black">
                        {m.renewalDate ? wallDay(m.renewalDate) : "—"}
                        {m.cancelAt ? <div className="text-xs text-danger">Cancels {centralDay(m.cancelAt)}</div> : null}
                      </Td>
                      {canMoveDates ? (
                        <Td>
                          {m.status === "active" && m.hasStripe ? (
                            <BillingDateForm membershipId={m.id} current={isoDay(m.renewalDate)} />
                          ) : (
                            <span className="text-xs text-gray-dark">{m.hasStripe ? "—" : "Not billed in Stripe"}</span>
                          )}
                        </Td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        {seePayments ? (
          <Card as="section">
            <CardHeader title="Owed" count={data.owed.length} />
            {data.owed.length === 0 ? (
              <EmptyState headline="All square." detail="This family doesn't owe anything for a class, camp or league." />
            ) : (
              <TableWrap>
                <table className="w-full">
                  <thead>
                    <tr><Th>Athlete</Th><Th>For</Th><Th>Amount</Th><Th>Status</Th><Th>Get Paid</Th></tr>
                  </thead>
                  <tbody>
                    {data.owed.map((o) => (
                      <tr key={`${o.kind}-${o.id}`} className="align-top">
                        <Td>
                          <Link href={`/os/athletes/${o.athleteId}`} className="font-medium text-near-black hover:underline">{o.athlete}</Link>
                        </Td>
                        <Td>
                          <div className="text-near-black">{o.what}</div>
                          <div className="text-xs text-gray-dark">
                            {o.kind === "booking" ? `Class · ${wallDayTime(o.when)}` : `Registered ${centralDay(o.when)}`}
                          </div>
                        </Td>
                        <Td className="os-num font-semibold text-near-black">{moneyExact(o.amountCents)}</Td>
                        <Td>
                          <Pill tone={o.status === "failed" ? "danger" : "warning"}>{o.status === "failed" ? "Card failed" : "Due"}</Pill>
                        </Td>
                        <Td>
                          <OwedActions kind={o.kind} id={o.id} canSendLink={canSendLink} canWaive={can(actor, "plans.manage")} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        ) : null}

        <Card as="section">
          <CardHeader title="Coming Up" count={data.upcomingCount} />
          {data.upcoming.length === 0 ? (
            <EmptyState headline="Nothing booked." detail="No upcoming classes for this family." />
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr><Th>When</Th><Th>Class</Th><Th>Athlete</Th><Th>Status</Th></tr>
                </thead>
                <tbody>
                  {data.upcoming.map((b) => (
                    <tr key={b.id}>
                      <Td className="os-num whitespace-nowrap text-near-black">{wallDayTime(b.start)}</Td>
                      <Td className="text-near-black">{b.what}</Td>
                      <Td>
                        <Link href={`/os/athletes/${b.athleteId}`} className="hover:underline">{b.athlete}</Link>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone={b.status === "attended" ? "success" : "neutral"}>
                            {b.status === "attended" ? "Checked in" : "Booked"}
                          </Pill>
                          {seePayments && (b.paymentStatus === "due" || b.paymentStatus === "failed") ? (
                            <Pill tone={b.paymentStatus === "failed" ? "danger" : "warning"}>
                              {b.paymentStatus === "failed" ? "Card failed" : "Payment due"}
                            </Pill>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Recent" count={data.recent.length} />
          {data.recent.length === 0 ? (
            <EmptyState headline="No history yet." detail="Past classes for this family will show here." />
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr><Th>When</Th><Th>Class</Th><Th>Athlete</Th><Th>Attendance</Th></tr>
                </thead>
                <tbody>
                  {data.recent.map((b) => {
                    const label = attendanceLabel(b.attendance, b.bookingStatus);
                    return (
                      <tr key={b.id}>
                        <Td className="os-num whitespace-nowrap text-gray-dark">{wallDayTime(b.start)}</Td>
                        <Td className="text-near-black">{b.what}</Td>
                        <Td>
                          <Link href={`/os/athletes/${b.athleteId}`} className="hover:underline">{b.athlete}</Link>
                        </Td>
                        <Td>
                          {label === "—" ? (
                            <span className="text-neutral">—</span>
                          ) : (
                            <Pill tone={label === "Here" ? "success" : label === "No show" ? "danger" : "neutral"}>{label}</Pill>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Waivers" />
          {active.length === 0 ? (
            <EmptyState headline="No athletes yet." detail="Waivers are tracked per athlete." />
          ) : (
            active.map((a) => {
              const missing = data.missingWaivers.get(a.id) ?? [];
              return (
                <Row key={a.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-body text-[14.5px] text-near-black">
                      {a.nickname?.trim() || a.firstName} {a.lastName}
                    </span>
                    {missing.length === 0 ? (
                      <Pill tone="success">All signed</Pill>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {missing.map((w) => (
                          <Pill key={w.id} tone="danger">{w.name}</Pill>
                        ))}
                      </span>
                    )}
                  </div>
                </Row>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
