import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { prisma } from "@/lib/prisma";
import { getWeeklySessionBalances } from "@/lib/entitlements";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { getCurrentGuardian } from "@/lib/dal";

// What this athlete is signed up for: their training plan, what it includes,
// and anything still needing a signature. Content that used to live on the
// single athlete page — it belongs behind its own tab now that the Player Card
// is the front door.

export default async function AthleteProgramsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const guardian = await getCurrentGuardian();

  const [membership, balances, unsignedWaivers, registrations] = await Promise.all([
    prisma.athleteMembership.findFirst({
      where: { athleteId: athlete.id, status: { in: ["active", "past_due"] } },
      include: { plan: true },
    }),
    getWeeklySessionBalances(athlete.id),
    getUnsignedRequiredWaivers(guardian.id, athlete.id),
    prisma.registration.findMany({
      where: { athleteId: athlete.id, status: { not: "cancelled" } },
      include: { offering: { include: { program: true } } },
      orderBy: { registeredAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {unsignedWaivers.length > 0 && (
        <div className="rounded-xl border border-orange bg-white p-4">
          <p className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
            Waiver Needed
          </p>
          <p className="mt-1 font-body text-[14px] text-gray-dark">
            {unsignedWaivers.map((w) => w.waiverType).join(", ")}
          </p>
          <Link
            href="/my-courts/waivers"
            className="mt-2 inline-block font-sport text-[12px] font-bold uppercase tracking-wide text-orange"
          >
            Sign Now &rarr;
          </Link>
        </div>
      )}

      <section>
        <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Training Plan
        </p>
        {membership ? (
          <div className="rounded-xl border border-gray-mid bg-white p-4">
            <p className="font-heading text-[15px] font-bold text-near-black">
              {membership.plan.name}
            </p>
            {membership.status === "past_due" && (
              <p className="mt-1 font-body text-[13.5px] text-orange">
                Payment didn&rsquo;t go through — update billing.
              </p>
            )}
            {balances[0] && (
              <p className="mt-1 font-body text-[13.5px] text-gray-dark">
                {balances[0].quantityPerPeriod - balances[0].usedThisWeek} of{" "}
                {balances[0].quantityPerPeriod} sessions remaining this week
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-mid bg-white p-4">
            <p className="font-body text-[14px] text-gray-dark">No active Training Plan.</p>
            <Link
              href="/my-courts/memberships"
              className="mt-2 inline-block font-sport text-[12px] font-bold uppercase tracking-wide text-orange"
            >
              View Plans &rarr;
            </Link>
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Registered For
        </p>
        {registrations.length === 0 ? (
          <p className="font-body text-[14px] text-gray-dark">Nothing registered yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
            {registrations.map((r) => (
              <li key={r.id} className="px-4 py-3.5">
                <p className="font-heading text-[14.5px] font-bold text-near-black">
                  {r.offering.program.name}
                </p>
                <p className="mt-0.5 font-body text-[13px] text-gray-dark">{r.offering.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
