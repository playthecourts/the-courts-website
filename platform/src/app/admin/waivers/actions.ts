"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import type { WaiverScope } from "@/generated/prisma/enums";

export async function createWaiver(_prevState: unknown, formData: FormData) {
  await getCurrentStaff();

  const waiver = await prisma.waiver.create({
    data: {
      waiverType: formData.get("waiverType") as string,
      version: formData.get("version") as string,
      content: formData.get("content") as string,
      scope: formData.get("scope") as WaiverScope,
      required: formData.get("required") === "on",
      effectiveDate: new Date(`${formData.get("effectiveDate") as string}T00:00:00Z`),
    },
  });
  revalidatePath("/admin/waivers");
  redirect(`/admin/waivers/${waiver.id}`);
}

export async function updateWaiver(waiverId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.waiver.update({
    where: { id: waiverId },
    data: {
      waiverType: formData.get("waiverType") as string,
      version: formData.get("version") as string,
      content: formData.get("content") as string,
      scope: formData.get("scope") as WaiverScope,
      required: formData.get("required") === "on",
      effectiveDate: new Date(`${formData.get("effectiveDate") as string}T00:00:00Z`),
    },
  });
  revalidatePath(`/admin/waivers/${waiverId}`);
  revalidatePath("/admin/waivers");
}
