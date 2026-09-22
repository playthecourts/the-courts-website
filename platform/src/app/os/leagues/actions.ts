"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";

const LEAGUE_NAME = "Fall 2026 Basketball League";

async function leagueOffering() {
  return prisma.offering.findFirstOrThrow({ where: { name: LEAGUE_NAME } });
}

export async function createLeagueTeam(formData: FormData) {
  await requireCapability("leagues.manage");
  const name = String(formData.get("name") ?? "").trim();
  const division = String(formData.get("division") ?? "").trim();
  if (!name) return;

  const offering = await leagueOffering();
  await prisma.team.create({
    data: { programId: offering.programId, offeringId: offering.id, name, division: division || null },
  });
  revalidatePath("/os/leagues");
}

// A player belongs to one League team at a time: placing them elsewhere moves
// them rather than leaving them on two rosters.
export async function placeOnTeam(formData: FormData) {
  await requireCapability("leagues.manage");
  const athleteId = String(formData.get("athleteId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!athleteId || !teamId) return;

  const offering = await leagueOffering();
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId, offeringId: offering.id } });

  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { athleteId, team: { offeringId: offering.id } } }),
    prisma.teamMember.create({ data: { teamId: team.id, athleteId } }),
  ]);
  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}

export async function removeFromTeam(formData: FormData) {
  await requireCapability("leagues.manage");
  const athleteId = String(formData.get("athleteId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  await prisma.teamMember.deleteMany({ where: { athleteId, teamId } });
  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}

const JERSEY_SIZES = ["Youth Small", "Youth Medium", "Youth Large", "Youth XL", "Adult Small", "Adult Medium", "Adult Large"];

export async function setJerseySize(formData: FormData) {
  await requireCapability("leagues.manage");
  const athleteId = String(formData.get("athleteId") ?? "");
  const jerseySize = String(formData.get("jerseySize") ?? "").trim() || null;
  if (!athleteId) return;
  if (jerseySize && !JERSEY_SIZES.includes(jerseySize)) return;

  await prisma.athlete.update({ where: { id: athleteId }, data: { jerseySize } });
  revalidatePath("/os/leagues");
}
