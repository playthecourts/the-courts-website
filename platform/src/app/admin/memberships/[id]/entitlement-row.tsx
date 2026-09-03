"use client";

import { removeEntitlement } from "@/app/admin/memberships/actions";

type Props = {
  entitlementId: string;
  planId: string;
  benefitType: string;
  programName: string | null;
  quantityPerPeriod: number | null;
};

export function EntitlementRow({ entitlementId, planId, benefitType, programName, quantityPerPeriod }: Props) {
  const label =
    benefitType === "class_credit"
      ? `${quantityPerPeriod ?? "?"}× ${programName ?? "any program"} per week — included`
      : benefitType === "member_pricing"
        ? `Member pricing — ${programName ?? "all programs"}`
        : `League eligibility — ${programName ?? "any league"}`;

  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
      <span>{label}</span>
      <button
        onClick={() => removeEntitlement(entitlementId, planId)}
        className="text-xs font-medium text-red-600 underline"
      >
        Remove
      </button>
    </div>
  );
}
