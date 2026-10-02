import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { loadPaymentsOverview, type PayerInfo } from "@/lib/payments";
import { money, moneyExact } from "@/lib/os/format";
import { PageHeader, Card, CardHeader, EmptyState, Metric, Pill, TableWrap, Th, Td } from "../_components/ui";
import { OwedActions, BillingDateForm } from "./row-actions";

export const dynamic = "force-dynamic";

// Payments: who owes us, whose card failed, who renews this week, what came
// in. The one page the desk and the owner open for money questions. Refunds
// and card changes still happen in Stripe — each row links straight to the
// family's Stripe customer so nobody has to search for them.

// Class times and Date-only columns are wall-clock (UTC); registeredAt is a
// real timestamp, shown in Central.
const wallDay = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
const wallDayTime = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
const centralDay = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }).format(d);
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function Payer({ p }: { p: PayerInfo }) {
  return (
    <div className="text-sm">
      <div className="font-medium text-near-black">{p.guardianName ?? p.familyName}</div>
      <div className="text-xs text-gray-dark">
        {[p.phone ? <a key="ph" href={`tel:${p.phone}`} className="os-num hover:underline">{p.phone}</a> : null, p.email]
          .filter(Boolean)
          .map((x, i) => <span key={i}>{i ? " · " : ""}{x}</span>)}
      </div>
    </div>
  );
}

function StripeLink({ p }: { p: PayerInfo }) {
  if (!p.stripeCustomerId) return null;
  return (
    <a
      href={`https://dashboard.stripe.com/customers/${p.stripeCustomerId}`}
      target="_blank"
      rel="noreferrer"
      className="os-eyebrow text-orange underline underline-offset-2"
    >
      Open in Stripe
    </a>
  );
}

export default async function PaymentsPage() {
  const actor = await requireCapability("payments.view");
  const canMarkPaid = can(actor, "payments.markPaid");
  const canSendLink = can(actor, "payments.sendLink");
  const canMoveDates = can(actor, "plans.manage");
  const data = await loadPaymentsOverview(actor);

  return (
    <div>
      <PageHeader
        eyebrow="Money"
        title="Payments"
        subtitle="What's owed, whose card failed, who renews this week, and what came in. Refunds and card changes: open the family in Stripe."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Owed" value={moneyExact(data.owedTotalCents)} detail={`${data.owed.length} item${data.owed.length === 1 ? "" : "s"}`} tone={data.owed.length ? "warning" : undefined} />
        <Metric label="Failed Memberships" value={data.pastDue.length} detail="Card declined" tone={data.pastDue.length ? "danger" : undefined} />
        <Metric label="Renewing This Week" value={data.renewals.length} detail={moneyExact(data.renewals.reduce((n, r) => n + r.priceCents, 0))} />
        <Metric label="Paid Bookings, 30 Days" value={moneyExact(data.recentTotalCents)} detail="Booked in the last 30 days" />
      </div>

      <div className="flex flex-col gap-5">
        <Card as="section">
          <CardHeader title="Owed" count={data.owed.length} />
          {data.owed.length === 0 ? (
            <EmptyState headline="All square." detail="Nobody owes anything for a class, camp or league right now." />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr><Th>Athlete</Th><Th>For</Th><Th>Amount</Th><Th>Parent</Th><Th>Collect</Th></tr>
                </thead>
                <tbody>
                  {data.owed.map((o) => (
                    <tr key={`${o.kind}-${o.id}`} className="align-top">
                      <Td>
                        <Link href={`/os/athletes/${o.athleteId}`} className="font-medium text-near-black hover:underline">{o.athlete}</Link>
                        <div className="mt-1"><Pill tone={o.status === "failed" ? "danger" : "warning"}>{o.status === "failed" ? "Card failed" : "Due"}</Pill></div>
                      </Td>
                      <Td>
                        <div className="text-near-black">{o.what}</div>
                        <div className="text-xs text-gray-dark">{o.kind === "booking" ? `Class · ${wallDayTime(o.when)}` : `Registered ${centralDay(o.when)}`}</div>
                      </Td>
                      <Td className="os-num font-semibold text-near-black">{money(o.amountCents)}</Td>
                      <Td>
                        <Payer p={o.payer} />
                        <div className="mt-1"><StripeLink p={o.payer} /></div>
                      </Td>
                      <Td>
                        <OwedActions kind={o.kind} id={o.id} canMarkPaid={canMarkPaid} canSendLink={canSendLink} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Failed Memberships" count={data.pastDue.length} />
          {data.pastDue.length === 0 ? (
            <EmptyState headline="No declined cards." detail="Every membership's last charge went through." />
          ) : (
            <>
              <p className="border-b border-gray-mid px-4 py-3 text-sm text-gray-dark">
                Stripe retries the card automatically. To fix it now, ask the parent to update their card in My Courts → Membership → Manage Billing, or open them in Stripe.
              </p>
              <TableWrap>
                <table>
                  <thead>
                    <tr><Th>Athlete</Th><Th>Plan</Th><Th>Amount</Th><Th>Parent</Th><Th>Stripe</Th></tr>
                  </thead>
                  <tbody>
                    {data.pastDue.map((m) => (
                      <tr key={m.id}>
                        <Td><Link href={`/os/athletes/${m.athleteId}`} className="font-medium text-near-black hover:underline">{m.athlete}</Link></Td>
                        <Td>{m.plan}</Td>
                        <Td className="os-num">{money(m.priceCents)}/mo</Td>
                        <Td><Payer p={m.payer} /></Td>
                        <Td><StripeLink p={m.payer} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Renewing in the Next 7 Days" count={data.renewals.length} />
          {data.renewals.length === 0 ? (
            <EmptyState headline="Quiet week." detail="No memberships renew in the next 7 days." />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr><Th>Athlete</Th><Th>Plan</Th><Th>Amount</Th><Th>Next Charge</Th>{canMoveDates ? <Th>Move Next Charge</Th> : null}</tr>
                </thead>
                <tbody>
                  {data.renewals.map((m) => (
                    <tr key={m.id} className="align-top">
                      <Td>
                        <Link href={`/os/athletes/${m.athleteId}`} className="font-medium text-near-black hover:underline">{m.athlete}</Link>
                        <div className="text-xs text-gray-dark">{m.payer.guardianName ?? m.payer.familyName}</div>
                      </Td>
                      <Td>{m.plan}</Td>
                      <Td className="os-num">{money(m.priceCents)}</Td>
                      <Td className="os-num">{m.renewalDate ? wallDay(m.renewalDate) : "—"}</Td>
                      {canMoveDates ? (
                        <Td>{m.hasStripe ? <BillingDateForm membershipId={m.id} current={isoDay(m.renewalDate)} /> : <span className="text-xs text-gray-dark">Not billed in Stripe</span>}</Td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card as="section">
          <CardHeader title="Booked in the Last 30 Days, Paid" count={data.recent.length} />
          {data.recent.length === 0 ? (
            <EmptyState headline="Nothing yet." detail="Paid classes, camps and leagues from the last 30 days show here. Membership charges are in Stripe." />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr><Th>Date</Th><Th>Athlete</Th><Th>For</Th><Th>Amount</Th><Th>Receipt</Th></tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.key}>
                      <Td className="os-num text-gray-dark">{centralDay(r.on)}</Td>
                      <Td>{r.athlete}</Td>
                      <Td>{r.what}</Td>
                      <Td className="os-num">{money(r.amountCents)}</Td>
                      <Td>
                        {r.receiptUrl ? (
                          <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="os-eyebrow text-orange underline underline-offset-2">Receipt</a>
                        ) : (
                          <span className="text-xs text-gray-dark">No receipt</span>
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
    </div>
  );
}
