"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";

const VALID_PRIORITIES = ["low", "medium", "high"] as const;

export async function createTask(formData: FormData) {
  const actor = await requireCapability("tasks.manage");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "Operations").trim() || "Operations";
  const priorityRaw = String(formData.get("priority") ?? "medium");
  const priority = VALID_PRIORITIES.includes(priorityRaw as (typeof VALID_PRIORITIES)[number]) ? priorityRaw : "medium";
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const detail = String(formData.get("detail") ?? "").trim();
  if (!title) return;

  await prisma.task.create({
    data: {
      title,
      category,
      priority: priority as "low" | "medium" | "high",
      detail: detail || null,
      dueDate: dueDateRaw ? new Date(`${dueDateRaw}T00:00:00Z`) : null,
      createdById: actor.id,
    },
  });
  revalidatePath("/os/tasks");
}

export async function toggleTaskDone(formData: FormData) {
  await requireCapability("tasks.manage");
  const id = String(formData.get("id") ?? "");
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });
  const done = task.status === "done";
  await prisma.task.update({
    where: { id },
    data: { status: done ? "open" : "done", completedAt: done ? null : new Date() },
  });
  revalidatePath("/os/tasks");
}

export async function setTaskPriority(formData: FormData) {
  await requireCapability("tasks.manage");
  const id = String(formData.get("id") ?? "");
  const priority = String(formData.get("priority") ?? "medium");
  if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) return;
  await prisma.task.update({ where: { id }, data: { priority: priority as "low" | "medium" | "high" } });
  revalidatePath("/os/tasks");
}

export async function deleteTask(formData: FormData) {
  await requireCapability("tasks.manage");
  const id = String(formData.get("id") ?? "");
  await prisma.task.delete({ where: { id } });
  revalidatePath("/os/tasks");
}
