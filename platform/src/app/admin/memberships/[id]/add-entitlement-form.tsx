import { addEntitlement } from "@/app/admin/memberships/actions";

type Program = { id: string; name: string };

export function AddEntitlementForm({ planId, programs }: { planId: string; programs: Program[] }) {
  const action = addEntitlement.bind(null, planId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <label className="flex flex-col gap-1 text-xs font-medium">
        Benefit
        <select name="benefitType" required defaultValue="class_credit" className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
          <option value="class_credit">Class credit (included, per week)</option>
          <option value="member_pricing">Member pricing</option>
          <option value="league_eligibility">League eligibility</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Program (blank = all)
        <select name="programId" className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
          <option value="">All programs</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Qty / week
        <input
          name="quantityPerPeriod"
          type="number"
          min="1"
          defaultValue="1"
          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Add Entitlement
      </button>
    </form>
  );
}
