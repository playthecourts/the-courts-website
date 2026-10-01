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

const GRADES = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

/// For a player who's on a team but didn't register through the app (signed
/// up in person, paid another way, added late). Creates the athlete — and a
/// family + parent login record if a parent email is given, reusing an
/// existing parent with that email — then places them on the team with a
/// jersey size. No charge, no League registration record: this only puts
/// them on the roster.
export async function addPlayerToTeam(formData: FormData) {
  await requireCapability("leagues.manage");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const dobRaw = String(formData.get("dob") ?? "").trim();
  const jerseySize = String(formData.get("jerseySize") ?? "").trim() || null;
  const teamId = String(formData.get("teamId") ?? "");
  const parentName = String(formData.get("parentName") ?? "").trim();
  const parentEmail = String(formData.get("parentEmail") ?? "").trim().toLowerCase();
  const parentPhone = String(formData.get("parentPhone") ?? "").trim();

  if (!firstName || !lastName || !teamId) throw new Error("Name and team are required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) throw new Error("Birthdate is required.");
  if (grade && !GRADES.includes(grade)) throw new Error("Pick a valid grade.");
  if (jerseySize && !JERSEY_SIZES.includes(jerseySize)) throw new Error("Pick a valid jersey size.");

  const offering = await leagueOffering();
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId, offeringId: offering.id } });

  await prisma.$transaction(async (tx) => {
    // Reuse the parent's existing family if they already have an account.
    const existingGuardian = parentEmail
      ? await tx.guardian.findUnique({
          where: { email: parentEmail },
          include: { families: { orderBy: { isPrimary: "desc" }, take: 1 } },
        })
      : null;

    let familyId = existingGuardian?.families[0]?.familyId ?? null;
    if (!familyId) {
      const family = await tx.family.create({ data: { name: `${lastName} Family` } });
      familyId = family.id;
      if (parentEmail || parentName) {
        const guardian =
          existingGuardian ??
          (await tx.guardian.create({
            data: { name: parentName || `${lastName} Parent`, email: parentEmail || null, phone: parentPhone || null },
          }));
        await tx.familyGuardian.create({ data: { familyId, guardianId: guardian.id, isPrimary: true } });
      }
    }

    const athlete = await tx.athlete.create({
      data: {
        familyId,
        firstName,
        lastName,
        dob: new Date(`${dobRaw}T00:00:00Z`),
        grade: grade || null,
        jerseySize,
      },
    });
    await tx.teamMember.deleteMany({ where: { athleteId: athlete.id, team: { offeringId: offering.id } } });
    await tx.teamMember.create({ data: { teamId: team.id, athleteId: athlete.id } });
  });

  revalidatePath("/os/leagues");
  revalidatePath("/my-courts/league");
}
