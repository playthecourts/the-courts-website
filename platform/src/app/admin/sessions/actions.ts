"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@/generated/prisma/enums";

export async function markAttendance(bookingId: string, sessionId: string, status: BookingStatus) {
  await getCurrentStaff();
  await prisma.booking.update({ where: { id: bookingId }, data: { status } });
  revalidatePath(`/admin/sessions/${sessionId}`);
}
