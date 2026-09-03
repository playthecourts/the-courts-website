"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { assertResourceAvailable } from "@/lib/resources";

export async function createResource(_prevState: unknown, formData: FormData) {
  await getCurrentStaff();

  const resource = await prisma.resource.create({
    data: {
      name: formData.get("name") as string,
      resourceType: formData.get("resourceType") as string,
      capacity: parseInt((formData.get("capacity") as string) || "1", 10),
    },
  });
  revalidatePath("/admin/resources");
  redirect(`/admin/resources/${resource.id}`);
}

export async function updateResource(resourceId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      name: formData.get("name") as string,
      resourceType: formData.get("resourceType") as string,
      capacity: parseInt((formData.get("capacity") as string) || "1", 10),
    },
  });
  revalidatePath(`/admin/resources/${resourceId}`);
  revalidatePath("/admin/resources");
}

// Ad-hoc court/resource rental — not tied to the Program/Session catalog.
// The datetime-local -> literal-UTC treatment matches the session forms.
export async function createReservation(resourceId: string, formData: FormData) {
  await getCurrentStaff();

  const startTime = new Date(`${formData.get("startTime") as string}Z`);
  const durationMinutes = parseInt(formData.get("durationMinutes") as string, 10);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
  const familyId = formData.get("familyId") as string;

  await prisma.$transaction(async (tx) => {
    await assertResourceAvailable(tx, resourceId, startTime, endTime);
    await tx.resourceReservation.create({
      data: { resourceId, familyId, startTime, endTime },
    });
  });
  revalidatePath(`/admin/resources/${resourceId}`);
}

export async function cancelReservation(reservationId: string, resourceId: string) {
  await getCurrentStaff();
  await prisma.resourceReservation.update({
    where: { id: reservationId },
    data: { status: "cancelled" },
  });
  revalidatePath(`/admin/resources/${resourceId}`);
}
