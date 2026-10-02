import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { formatGrade, formatTimeRange, formatLongDate, addDays } from "@/lib/coach-format";
import { PageHeader, Card, EmptyState, Pill, TableWrap, Th, Td } from "../_components/ui";
import { can } from "@/lib/os/permissions";
import { AddAthleteForm, type AthleteOption } from "./add-athlete-form";

export const dynamic = "force-dynamic";

// Class Rosters: every session on a day, with exactly who is signed up for it.
// One card per session, in time order. Bookings are the source of truth — the
// same rows the Parent App writes and the capacity counts on the public
// schedule read — so this list and "3/12 signed up" can never disagree.
//
// Dates follow the platform's UTC-wall-clock convention (see coach-format.ts):
// a 5 PM class on Oct 1 is stored as 2026-10-01T17:00Z, so a "day" here is the
// UTC calendar day. "Today" is resolved in Central time so the page opens on
// the right day for the front desk.

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const todayCentral = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayStrip = (d: Date) => ({
  dow: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d),
  num: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d),
});

const PAY_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  paid: { label: "Paid", tone: "success" },
  none: { label: "Membership / free", tone: "neutral" },
  pending: { label: "Checkout pending", tone: "warning" },
  due: { label: "Due", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
  partially_refunded: { label: "Part refunded", tone: "info" },
};

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireCapability("registrations.view");
  const canAdd = can(actor, "registrations.create");
  const sp = await searchParams;
  const dateParam = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayCentral();
  const sport = typeof sp.sport === "string" ? sp.sport : "all";
  const showEmpty = sp.empty !== "hide";

  const dayStart = new Date(`${dateParam}T00:00:00Z`);
  const dayEnd = addDays(dayStart, 1);

  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: dayStart, lt: dayEnd },
      ...(sport !== "all" ? { program: { sport } } : {}),
    },
    orderBy: [{ startTime: "asc" }],
    select: {
      id: true, title: true, startTime: true, endTime: true, capacity: true, status: true, cancellationReason: true,
      offering: { select: { id: true, name: true } },
      program: { select: { name: true, sport: true } },
      resource: { select: { name: true } },
      coaches: { select: { staff: { select: { name: true } } } },
      bookings: {
        where: { status: { not: "cancelled" } },
        orderBy: { bookedAt: "asc" },
        select: {
          id: true, status: true, paymentStatus: true, priceChargedCents: true, bookedAt: true, registrationId: true,
          athlete: {
            select: {
              id: true, firstName: true, lastName: true, nickname: true, grade: true,
              family: {
                select: {
                  guardians: {
                    orderBy: { isPrimary: "desc" },
                    take: 1,
                    select: { guardian: { select: { name: true, phone: true, email: true } } },
                  },
                },
              },
            },
          },
        },
      },
      waitlistEntries: { where: { status: { in: ["waiting", "offered"] } }, select: { id: true } },
    },
  });

  // Everyone who could be added to a class, for the "Add athlete" picker on
  // each card. Fetched once for the page, not per card.
  const athleteOptions: AthleteOption[] = canAdd
    ? (
        await prisma.athlete.findMany({
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, nickname: true, lastName: true, grade: true },
        })
      ).map((a) => ({
        id: a.id,
        label: `${a.lastName}, ${a.nickname || a.firstName}${a.grade ? ` · ${formatGrade(a.grade)}` : ""}`,
      }))
    : [];

  const visible = sessions.filter((s) => showEmpty || s.bookings.length > 0);
  const live = sessions.filter((s) => s.status === "scheduled");
  const totalSignedUp = live.reduce((n, s) => n + s.bookings.length, 0);
  const totalSeats = live.reduce((n, s) => n + s.capacity, 0);

  // Week strip centred on the selected day.
  const strip = Array.from({ length: 7 }, (_, i) => addDays(dayStart, i - 3));

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ date: dateParam, sport: sport === "all" ? undefined : sport, empty: showEmpty ? undefined : "hide", ...next })) {
      if (v) params.set(k, v);
    }
    return `/os/rosters?${params.toString()}`;
  }

  const chip = (active: boolean) =>
    `os-eyebrow inline-flex min-h-9 items-center rounded-full border px-3 ${
      active ? "border-near-black bg-near-black text-white" : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
    }`;

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Class Rosters"
        subtitle={`${formatLongDate(dayStart)} · ${live.length} class${live.length === 1 ? "" : "es"} · ${totalSignedUp} signed up${totalSeats ? ` of ${totalSeats} spots` : ""}`}
      />

      {/* Day strip */}
      <nav aria-label="Pick a day" className="mb-4 flex items-stretch gap-1.5 overflow-x-auto pb-1">
        <Link href={href({ date: ymd(addDays(dayStart, -7)) })} className={chip(false)} aria-label="Previous week">‹</Link>
        {strip.map((d) => {
          const key = ymd(d);
          const { dow, num } = dayStrip(d);
          const active = key === dateParam;
          return (
            <Link
              key={key}
              href={href({ date: key })}
              aria-current={active ? "date" : undefined}
              className={`flex min-w-[4.5rem] flex-col items-center rounded-lg border px-2 py-1.5 text-center ${
                active ? "border-orange bg-orange text-white" : "border-gray-mid bg-white text-near-black hover:border-near-black"
              }`}
            >
              <span className="os-eyebrow text-[10px]">{dow}</span>
              <span className="text-sm font-semibold">{num}</span>
            </Link>
          );
        })}
        <Link href={href({ date: ymd(addDays(dayStart, 7)) })} className={chip(false)} aria-label="Next week">›</Link>
        {dateParam !== todayCentral() ? (
          <Link href={href({ date: todayCentral() })} className={`${chip(false)} ml-1`}>Today</Link>
        ) : null}
      </nav>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {["all", "Basketball", "Volleyball"].map((s) => (
          <Link key={s} href={href({ sport: s === "all" ? undefined : s })} className={chip(sport === s)}>
            {s === "all" ? "All sports" : s}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-mid" />
        <Link href={href({ empty: showEmpty ? "hide" : undefined })} className={chip(!showEmpty)}>
          {showEmpty ? "Hide empty classes" : "Showing booked only"}
        </Link>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState headline="No classes." detail={sessions.length ? "Nobody is signed up for a class this day yet." : "Nothing is scheduled this day."} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((s) => {
            const name = s.title ?? s.offering?.name ?? s.program.name;
            const cancelled = s.status === "cancelled";
            const count = s.bookings.length;
            const full = count >= s.capacity;
            const pct = s.capacity ? Math.min(100, Math.round((count / s.capacity) * 100)) : 0;
            const coaches = s.coaches.map((c) => c.staff.name.split(" ")[0]).join(", ");
            return (
              <Card key={s.id} as="section" className={cancelled ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-mid px-4 py-3">
                  <div className="min-w-0">
                    <p className="os-eyebrow text-orange">{formatTimeRange(s.startTime, s.endTime)}</p>
                    <h2 className="os-heading text-lg text-near-black">
                      {s.offering ? (
                        <Link href={`/os/offerings/${s.offering.id}`} className="hover:underline">{name}</Link>
                      ) : name}
                    </h2>
                    <p className="text-xs text-neutral">
                      {[s.program.sport, coaches && `Coach ${coaches}`, s.resource?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {cancelled ? (
                      <Pill tone="danger">Cancelled{s.cancellationReason ? ` · ${s.cancellationReason}` : ""}</Pill>
                    ) : (
                      <>
                        {s.waitlistEntries.length ? <Pill tone="info">{s.waitlistEntries.length} waitlisted</Pill> : null}
                        <div className="text-right">
                          <p className="os-num text-xl font-semibold text-near-black">
                            {count}<span className="text-sm text-neutral">/{s.capacity}</span>
                          </p>
                          <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-warm-stone">
                            <span className={`block h-full ${full ? "bg-danger" : "bg-orange"}`} style={{ width: `${pct}%` }} />
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {count === 0 ? (
                  <p className="px-4 py-3 text-sm text-neutral">No one signed up yet.</p>
                ) : (
                  <TableWrap>
                    <table>
                      <thead>
                        <tr><Th>#</Th><Th>Athlete</Th><Th>Grade</Th><Th>Parent</Th><Th>Phone</Th><Th>How</Th><Th>Signed up</Th></tr>
                      </thead>
                      <tbody>
                        {s.bookings.map((b, i) => {
                          const g = b.athlete.family.guardians[0]?.guardian;
                          const pay = b.registrationId
                            ? { label: "Camp / program", tone: "info" as const }
                            : PAY_LABEL[b.paymentStatus] ?? { label: b.paymentStatus, tone: "neutral" as const };
                          return (
                            <tr key={b.id}>
                              <Td className="os-num text-neutral">{i + 1}</Td>
                              <Td>
                                <Link href={`/os/athletes/${b.athlete.id}`} className="font-medium text-near-black hover:underline">
                                  {b.athlete.nickname || b.athlete.firstName} {b.athlete.lastName}
                                </Link>
                                {b.status === "attended" ? <span className="ml-2"><Pill tone="success">Checked in</Pill></span> : null}
                                {b.status === "no_show" ? <span className="ml-2"><Pill tone="danger">No show</Pill></span> : null}
                              </Td>
                              <Td className="text-neutral">{b.athlete.grade ? formatGrade(b.athlete.grade) : "—"}</Td>
                              <Td>{g?.name ?? "—"}</Td>
                              <Td>{g?.phone ? <a href={`tel:${g.phone}`} className="os-num hover:underline">{g.phone}</a> : "—"}</Td>
                              <Td><Pill tone={pay.tone}>{pay.label}</Pill></Td>
                              <Td className="os-num text-neutral">
                                {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }).format(b.bookedAt)}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableWrap>
                )}
                {canAdd && !cancelled ? (
                  <AddAthleteForm
                    sessionId={s.id}
                    athletes={athleteOptions.filter((a) => !s.bookings.some((b) => b.athlete.id === a.id))}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
