import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

function formatPrice(cents: number, interval: string) {
  return `$${(cents / 100).toFixed(2)}/${interval === "monthly" ? "mo" : "yr"}`;
}

export default async function MembershipsPage() {
  await getCurrentStaff();

  const plans = await prisma.membershipPlan.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true, entitlements: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Membership Plans</h1>
        <Link
          href="/admin/memberships/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          + New Plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-neutral-500">No membership plans yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/admin/memberships/${plan.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="font-medium">
                  {plan.name}
                  {!plan.active && <span className="ml-2 text-xs font-normal text-neutral-400">(inactive)</span>}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatPrice(plan.priceCents, plan.billingInterval)} · {plan._count.entitlements} entitlement
                  {plan._count.entitlements === 1 ? "" : "s"}
                  {plan.stripePriceId ? " · Online checkout on" : " · Online checkout off"}
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {plan._count.memberships} athlete{plan._count.memberships === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
