"use client";

import { updateMembershipStatus, assignMembership } from "@/app/admin/memberships/actions";

type Membership = {
  id: string;
  status: string;
  plan: { id: string; name: string };
};
type Plan = { id: string; name: string };

export function AthleteMembershipBlock({
  athleteId,
  athleteName,
  familyId,
  memberships,
  plans,
}: {
  athleteId: string;
  athleteName: string;
  familyId: string;
  memberships: Membership[];
  plans: Plan[];
}) {
  const assignAction = assignMembership.bind(null, athleteId, familyId);

  return (
    <div className="border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
      <p className="mb-2 font-medium">{athleteName}</p>
      {memberships.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between">
              <span>
                {m.plan.name} — <span className="text-neutral-500">{m.status}</span>
              </span>
              {m.status === "active" ? (
                <button
                  onClick={() => updateMembershipStatus(m.id, familyId, "cancelled")}
                  className="text-xs font-medium text-red-600 underline"
                >
                  Cancel
                </button>
              ) : (
                m.status === "cancelled" && (
                  <button
                    onClick={() => updateMembershipStatus(m.id, familyId, "active")}
                    className="text-xs font-medium underline"
                  >
                    Reactivate
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <form action={assignAction} className="flex items-end gap-2">
        <select name="membershipPlanId" required className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          <option value="">Assign plan…</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="startDate"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
        />
        <button type="submit" className="rounded-md bg-black px-2 py-1 text-xs font-semibold text-white">
          Assign
        </button>
      </form>
    </div>
  );
}
