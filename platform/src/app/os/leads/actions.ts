"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";

const VALID_STAGES = ["new", "contacted", "trial", "attended", "follow_up", "converted", "not_now"] as const;
const VALID_SOURCES = [
  "website", "parent_referral", "coach_referral", "walk_in", "social",
  "nextgen_rollover", "camp", "league_evaluation", "event", "rental", "other",
] as const;

export async function createLead(formData: FormData) {
  const actor = await requireCapability("leads.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const sport = String(formData.get("sport") ?? "").trim();
  const interest = String(formData.get("interest") ?? "").trim();
  const sourceRaw = String(formData.get("source") ?? "website");
  const source = VALID_SOURCES.includes(sourceRaw as (typeof VALID_SOURCES)[number]) ? sourceRaw : "website";

  await prisma.lead.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      sport: sport || null,
      interest: interest || null,
      source: source as (typeof VALID_SOURCES)[number],
      ownerId: actor.id,
    },
  });
  revalidatePath("/os/leads");
}

export async function setLeadStage(formData: FormData) {
  await requireCapability("leads.manage");
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) return;
  await prisma.lead.update({
    where: { id },
    data: { stage: stage as (typeof VALID_STAGES)[number], convertedAt: stage === "converted" ? new Date() : undefined },
  });
  revalidatePath("/os/leads");
}

export async function addLeadNote(formData: FormData) {
  const actor = await requireCapability("leads.manage");
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  await prisma.leadActivity.create({ data: { leadId: id, staffUserId: actor.id, note } });
  revalidatePath("/os/leads");
}

export async function deleteLead(formData: FormData) {
  await requireCapability("leads.manage");
  const id = String(formData.get("id") ?? "");
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/os/leads");
}
