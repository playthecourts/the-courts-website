import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateMembershipPlan } from "@/app/admin/memberships/actions";
import { EntitlementRow } from "./entitlement-row";
import { AddEntitlementForm } from "./add-entitlement-form";

export default async function MembershipPlanDetailPage(props: PageProps<"/admin/memberships/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const [plan, programs] = await Promise.all([
    prisma.membershipPlan.findUnique({
      where: { id },
      include: { entitlements: { include: { program: true } } },
    }),
    prisma.program.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!plan) notFound();

  const updateAction = updateMembershipPlan.bind(null, plan.id);

  return (
    <div className="flex flex-col gap-8">
      <form action={updateAction} className="flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            defaultValue={plan.name}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-lg font-bold"
          />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Price ($)
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(plan.priceCents / 100).toFixed(2)}
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Billing
            <select
              name="billingInterval"
              defaultValue={plan.billingInterval}
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-base"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            name="description"
            defaultValue={plan.description ?? ""}
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          Save
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Entitlements
        </h2>
        <div className="mb-4 rounded-lg border border-neutral-200">
          {plan.entitlements.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">
              No entitlements yet — this plan doesn&apos;t unlock anything until you add one.
            </p>
          ) : (
            plan.entitlements.map((entitlement) => (
              <EntitlementRow
                key={entitlement.id}
                entitlementId={entitlement.id}
                planId={plan.id}
                benefitType={entitlement.benefitType}
                programName={entitlement.program?.name ?? null}
                quantityPerPeriod={entitlement.quantityPerPeriod}
              />
            ))
          )}
        </div>
        <AddEntitlementForm planId={plan.id} programs={programs} />
      </section>
    </div>
  );
}
