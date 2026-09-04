"use client";

import { useActionState } from "react";
import { createMembershipPlan } from "@/app/admin/memberships/actions";

export function NewPlanForm() {
  const [, formAction, pending] = useActionState(createMembershipPlan, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          name="name"
          required
          placeholder="Weekly Basketball"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Price ($)
          <input name="price" type="number" step="0.01" min="0" required className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Billing
          <select name="billingInterval" required defaultValue="monthly" className="rounded-md border border-neutral-300 px-3 py-2 text-base">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Description (optional)
        <textarea name="description" rows={3} className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Stripe Price ID (optional)
        <input
          name="stripePriceId"
          placeholder="price_..."
          className="rounded-md border border-neutral-300 px-3 py-2 text-base font-mono text-sm"
        />
        <span className="text-xs font-normal text-neutral-500">
          From Stripe Dashboard → Product catalog. Leave blank until the plan is ready for online
          checkout — families won&rsquo;t see it as an option until this is set.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create plan"}
      </button>
    </form>
  );
}
