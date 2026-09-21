"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { autoPlaceLeague } from "@/lib/league-placement";

const LEAGUE_NAME = "Fall 2026 Basketball League";

async function leagueOffering() {
  return prisma.offering.findFirstOrThrow({ where: { name: LEAGUE_NAME } });
}

export async function createLeagueTeam(formData: FormData) {
  const actor = await requireCapability("leagues.manage");
  const name = String(formData.get("name") ?? "").trim();
  const division = String(formData.get("division") ?? "").trim();
  if (!name) return;

  const offering = await leagueOffering();
  const team = await prisma.team.create({
    data: { programId: offering.programId, offeringId: offering.id, name, division: division || null },
  });
  await auditLog(actor.id, "assign_team_member", "team", team.id, { created: name });
  revalidatePath("/os/leagues");
}

// A player belongs to one League team at a time: placing them elsewhere moves
// them rather than leaving them on two rosters.
export async function placeOnTeam(formData: FormData) {
  const actor = await requireCapability("leagues.manage");
  const athleteId = String(formData.get("athleteId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!athleteId || !teamId) return;

  const offering = await leagueOffering();
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId, offeringId: offering.id } });

  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { athleteId, team: { offeringId: offering.id } } }),
    prisma.teamMember.create({ data: { teamId: team.id, athleteId } }),
  ]);
  await auditLog(actor.id, "assign_team_member", "athlete", athleteId, { team: team.name });
  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}

export async function removeFromTeam(formData: FormData) {
  const actor = await requireCapability("leagues.manage");
  const athleteId = String(formData.get("athleteId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  await prisma.teamMember.deleteMany({ where: { athleteId, teamId } });
  await auditLog(actor.id, "remove_team_member", "athlete", athleteId, { teamId });
  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}

export async function autoPlaceByGrade() {
  const actor = await requireCapability("leagues.manage");
  const offering = await leagueOffering();
  const { assigned } = await autoPlaceLeague(prisma, offering.id);
  await auditLog(actor.id, "assign_team_member", "offering", offering.id, { autoPlaced: assigned.length });
  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}
