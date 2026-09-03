"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import type { BillingInterval, BenefitType } from "@/generated/prisma/enums";

function dollarsToCents(value: FormDataEntryValue | null): number {
  return Math.round(parseFloat(value as string) * 100);
}

export async function createMembershipPlan(_prevState: unknown, formData: FormData) {
  await getCurrentStaff();

  const plan = await prisma.membershipPlan.create({
    data: {
      name: formData.get("name") as string,
      priceCents: dollarsToCents(formData.get("price")),
      billingInterval: formData.get("billingInterval") as BillingInterval,
      description: (formData.get("description") as string) || null,
    },
  });
  revalidatePath("/admin/memberships");
  redirect(`/admin/memberships/${plan.id}`);
}

export async function updateMembershipPlan(planId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.membershipPlan.update({
    where: { id: planId },
    data: {
      name: formData.get("name") as string,
      priceCents: dollarsToCents(formData.get("price")),
      billingInterval: formData.get("billingInterval") as BillingInterval,
      description: (formData.get("description") as string) || null,
    },
  });
  revalidatePath(`/admin/memberships/${planId}`);
  revalidatePath("/admin/memberships");
}

export async function addEntitlement(planId: string, formData: FormData) {
  await getCurrentStaff();

  const benefitType = formData.get("benefitType") as BenefitType;
  const programId = (formData.get("programId") as string) || null;
  const quantity = formData.get("quantityPerPeriod") as string;

  await prisma.planEntitlement.create({
    data: {
      membershipPlanId: planId,
      benefitType,
      programId,
      quantityPerPeriod: quantity ? parseInt(quantity, 10) : null,
    },
  });
  revalidatePath(`/admin/memberships/${planId}`);
}

export async function removeEntitlement(entitlementId: string, planId: string) {
  await getCurrentStaff();
  await prisma.planEntitlement.delete({ where: { id: entitlementId } });
  revalidatePath(`/admin/memberships/${planId}`);
}

export async function assignMembership(athleteId: string, familyId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.athleteMembership.create({
    data: {
      athleteId,
      membershipPlanId: formData.get("membershipPlanId") as string,
      startDate: new Date(`${formData.get("startDate") as string}T00:00:00Z`),
    },
  });
  revalidatePath(`/admin/families/${familyId}`);
}

export async function updateMembershipStatus(
  membershipId: string,
  familyId: string,
  status: "active" | "paused" | "cancelled"
) {
  await getCurrentStaff();
  await prisma.athleteMembership.update({ where: { id: membershipId }, data: { status } });
  revalidatePath(`/admin/families/${familyId}`);
}
