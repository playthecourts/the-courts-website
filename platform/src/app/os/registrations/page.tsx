import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { registrationScope } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { expireStaleOffers } from "@/lib/programs/waitlist";
import { formatCents } from "@/lib/programs/format";
import { gradeRangeLabel, PROGRAM_TYPE_LABELS } from "@/lib/programs/types";
import {
  PageHeader, Card, CardHeader, EmptyState, Pill, TableWrap, Th, Td,
  REGISTRATION_TONE, PAYMENT_TONE,
} from "../_components/ui";

export const dynamic = "force-dynamic";

// Who is in what. Two lists, because they answer different questions:
// registrations (a family committed to an offering) and per-session seats
// (who is actually in the gym on a given night). Both read the same rows the
// Parent App writes — there is no separate roster to reconcile.

const VIEWS = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action" },
  { key: "waitlisted", label: "Waitlisted" },
  { key: "unpaid", label: "Unpaid" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);

export default async function RegistrationsPage({ searchParams }: PageProps<"/os/registrations">) {
  const actor = await requireCapability("registrations.view");
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  // Idempotent, and cheap: a lapsed offer should never keep holding a seat just
  // because no scheduled job has run.
  await expireStaleOffers();

  const where: Record<string, unknown> = { AND: [registrationScope(actor)] };
  switch (view) {
    case "needs_action":
      (where.AND as unknown[]).push({
        OR: [{ status: "admin_review" }, { status: "incomplete" }, { waiversComplete: false, status: "registered" }],
      });
      break;
    case "waitlisted":
      (where.AND as unknown[]).push({ status: "waitlisted" });
      break;
    case "unpaid":
      (where.AND as unknown[]).push({ paymentStatus: { in: ["due", "failed", "pending"] } });
      break;
    case "cancelled":
      (where.AND as unknown[]).push({ status: "cancelled" });
      break;
  }
  if (q) {
    (where.AND as unknown[]).push({
      OR: [
        { athlete: { firstName: { contains: q, mode: "insensitive" } } },
        { athlete: { lastName: { contains: q, mode: "insensitive" } } },
        { offering: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const [registrations, waitlist, offeringsWithSeats] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      take: 200,
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, grade: true } },
        offering: {
          select: {
            id: true, name: true, seasonLabel: true, priceCents: true,
            program: { select: { sport: true, programType: true } },
          },
        },
      },
    }),
    // Outstanding waitlist offers are the time-sensitive thing on this page.
    prisma.waitlistEntry.findMany({
      where: { status: { in: ["waiting", "offered"] } },
      orderBy: [{ status: "asc" }, { position: "asc" }],
      take: 50,
      include: {
        athlete: { select: { firstName: true, lastName: true } },
        session: {
          select: {
            id: true, startTime: true, capacity: true,
            offering: { select: { id: true, name: true } },
            program: { select: { name: true } },
            _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
          },
        },
      },
    }),
    prisma.offering.findMany({
      where: { status: { in: ["published", "registration_closed"] } },
      orderBy: { startDate: "desc" },
      take: 30,
      select: {
        id: true, name: true, seasonLabel: true, gradeMin: true, gradeMax: true,
        capacityTotal: true,
        program: { select: { sport: true } },
        _count: { select: { registrations: { where: { status: "registered" } } } },
        sessions: {
          where: { status: "scheduled" },
          select: { capacity: true, _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } },
        },
      },
    }),
  ]);

  const offered = waitlist.filter((w) => w.status === "offered");

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, q, ...next })) if (v) params.set(k, v);
    const s = params.toString();
    return `/os/registrations${s ? `?${s}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Registrations"
        subtitle="Who committed to what, and who is still waiting on a seat."
      />

      {/* Outstanding offers first — these expire. */}
      {offered.length > 0 ? (
        <div className="mb-5 rounded-xl border border-info/30 bg-info-bg p-4">
          <p className="os-eyebrow mb-2 text-info">
            {offered.length} waitlist offer{offered.length === 1 ? "" : "s"} outstanding
          </p>
          <ul className="flex flex-col gap-1 text-sm text-info">
            {offered.map((w) => (
              <li key={w.id}>
                {w.athlete.firstName} {w.athlete.lastName} ·{" "}
                {w.session.offering?.name ?? w.session.program.name} · {fmtDate(w.session.startTime)}
                {w.offerExpiresAt ? ` · expires ${fmtDate(w.offerExpiresAt)}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-info">
            A spot is held, not booked. Nobody is charged unless the family accepts.
          </p>
        </div>
      ) : null}

      <nav aria-label="Registration views" className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ view: v.key })}
            aria-current={view === v.key ? "page" : undefined}
            className={`os-eyebrow inline-flex min-h-9 items-center rounded-full border px-3 ${
              view === v.key
                ? "border-near-black bg-near-black text-white"
                : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <form method="get" action="/os/registrations" className="mb-5 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <div>
          <label htmlFor="q" className="os-eyebrow mb-1.5 block text-gray-dark">Search</label>
          <input
            id="q" name="q" defaultValue={q} placeholder="Athlete or program…"
            className="min-h-11 w-64 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          />
        </div>
        <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
          Search
        </button>
        {q ? <Link href={href({ q: undefined })} className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">Clear</Link> : null}
      </form>

      <Card className="mb-5">
        <CardHeader title="Registrations" count={registrations.length} />
        {registrations.length === 0 ? (
          <EmptyState
            headline="Nothing here."
            detail={
              view === "all"
                ? "Offering-level registrations appear here once families register for a camp, clinic or league season. Single-session bookings show on the session itself."
                : "No registrations match this view."
            }
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <Th>Athlete</Th><Th>Program</Th><Th>Status</Th>
                  <Th>Payment</Th><Th>Amount</Th><Th>Registered</Th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="font-medium text-near-black">
                        {r.athlete.firstName} {r.athlete.lastName}
                      </span>
                      {r.athlete.grade ? <span className="ml-2 text-xs text-neutral">{r.athlete.grade}</span> : null}
                    </Td>
                    <Td>
                      <Link href={`/os/offerings/${r.offering.id}`} className="text-near-black underline underline-offset-2">
                        {r.offering.name}
                      </Link>
                      <span className="block text-xs text-neutral">
                        {[r.offering.program.sport, PROGRAM_TYPE_LABELS[r.offering.program.programType], r.offering.seasonLabel]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={REGISTRATION_TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Pill>
                      {!r.waiversComplete && r.status === "registered" ? (
                        <span className="ml-1"><Pill tone="danger">Waiver</Pill></span>
                      ) : null}
                    </Td>
                    <Td><Pill tone={PAYMENT_TONE[r.paymentStatus] ?? "neutral"}>{r.paymentStatus.replace(/_/g, " ")}</Pill></Td>
                    <Td className="os-num">{formatCents(r.amountCents ?? r.offering.priceCents)}</Td>
                    <Td className="os-num text-neutral">{fmtDate(r.registeredAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Fill by offering" count={offeringsWithSeats.length} />
        {offeringsWithSeats.length === 0 ? (
          <EmptyState headline="Nothing published." detail="Published offerings and how full they are will show here." />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr><Th>Offering</Th><Th>Grades</Th><Th>Registered</Th><Th>Seats</Th><Th>Fill</Th></tr>
              </thead>
              <tbody>
                {offeringsWithSeats.map((o) => {
                  const seats = o.capacityTotal ?? o.sessions.reduce((n, s) => n + s.capacity, 0);
                  const taken = o.capacityTotal
                    ? o._count.registrations
                    : o.sessions.reduce((n, s) => n + s._count.bookings, 0);
                  const pct = seats > 0 ? Math.round((taken / seats) * 100) : null;
                  return (
                    <tr key={o.id}>
                      <Td>
                        <Link href={`/os/offerings/${o.id}`} className="text-near-black underline underline-offset-2">
                          {o.name}
                        </Link>
                        {o.seasonLabel ? <span className="ml-2 text-xs text-neutral">{o.seasonLabel}</span> : null}
                      </Td>
                      <Td className="text-neutral">{gradeRangeLabel(o.gradeMin, o.gradeMax) ?? "All"}</Td>
                      <Td className="os-num">{taken}</Td>
                      <Td className="os-num text-neutral">{seats || "—"}</Td>
                      <Td>
                        {pct === null ? "—" : (
                          <span className="flex items-center gap-2">
                            <span className="os-num w-10">{pct}%</span>
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-warm-stone">
                              <span
                                className={`block h-full ${pct >= 100 ? "bg-danger" : pct >= 70 ? "bg-success" : "bg-orange"}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </span>
                          </span>
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
    </div>
  );
}
