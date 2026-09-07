import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getWeeklySessionBalances } from "@/lib/entitlements";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";

function formatSessionTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function AthleteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athlete = athletes.find((a) => a.id === id);

  // Ownership check — never trust the URL param alone for a minor's record.
  if (!athlete) notFound();

  const [membership, upcomingBookings, balances, unsignedWaivers] = await Promise.all([
    prisma.athleteMembership.findFirst({
      where: { athleteId: athlete.id, status: { in: ["active", "past_due"] } },
      include: { plan: true },
    }),
    prisma.booking.findMany({
      where: { athleteId: athlete.id, status: { not: "cancelled" }, session: { startTime: { gte: new Date() } } },
      orderBy: { session: { startTime: "asc" } },
      include: { session: { include: { program: true } } },
    }),
    getWeeklySessionBalances(athlete.id),
    getUnsignedRequiredWaivers(guardian.id, athlete.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/my-courts/athletes" className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
          &larr; My Athletes
        </Link>
        <h1 className="mt-2 font-display text-2xl font-black text-black">
          {athlete.firstName} {athlete.lastName}
        </h1>
        <p className="mt-1 font-body text-sm text-gray-dark">{athlete.grade ? `Grade ${athlete.grade}` : "Grade not on file"}</p>
      </div>

      {unsignedWaivers.length > 0 && (
        <div className="rounded-lg border border-orange bg-white p-4">
          <p className="font-sport text-xs font-bold uppercase tracking-wide text-orange">Waiver Needed</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            {unsignedWaivers.map((w) => w.waiverType).join(", ")}
          </p>
          <Link href="/my-courts/waivers" className="mt-2 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange">
            Sign Now &rarr;
          </Link>
        </div>
      )}

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Training Plan</p>
        {membership ? (
          <div className="rounded-lg border border-gray-mid bg-white p-4">
            <p className="font-heading font-bold text-black">{membership.plan.name}</p>
            {membership.status === "past_due" && (
              <p className="mt-1 font-body text-sm text-orange">Payment didn&rsquo;t go through — update billing.</p>
            )}
            {balances[0] && (
              <p className="mt-1 font-body text-sm text-gray-dark">
                {balances[0].quantityPerPeriod - balances[0].usedThisWeek} of {balances[0].quantityPerPeriod} sessions remaining
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-mid bg-white p-4">
            <p className="font-body text-sm text-gray-dark">No active Training Plan.</p>
            <Link href="/my-courts/memberships" className="mt-2 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange">
              View Plans &rarr;
            </Link>
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Upcoming</p>
        {upcomingBookings.length === 0 ? (
          <p className="font-body text-sm text-gray-dark">Nothing booked yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {upcomingBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <p className="font-heading text-sm font-bold text-black">{b.session.program.name}</p>
                <p className="font-body text-sm text-gray-dark">{formatSessionTime(b.session.startTime)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
