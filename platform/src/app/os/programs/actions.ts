"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability, OsAccessError } from "@/lib/os/dal";
import { canForSport } from "@/lib/os/permissions";
import { auditLog } from "@/lib/audit";
import { programTypeDef } from "@/lib/programs/types";
import type { ProgramType } from "@/generated/prisma/enums";
import { str, reqStr } from "@/lib/programs/actions-shared";

// Creating something is deliberately two decisions, not one form:
//   1. WHAT kind of thing is this? (program type — picks the workflow)
//   2. Is it a new definition, or a new season of one we already run?
// Step 2 is what stops "Fall 2026 League" and "Winter 2027 League" becoming two
// unrelated programs.

export async function createOffering(_prev: unknown, formData: FormData) {
  const actor = await requireCapability("programs.create");

  const programType = reqStr(formData, "programType", "Program type") as ProgramType;
  const def = programTypeDef(programType);
  const sport = str(formData, "sport");

  if (!canForSport(actor, "programs.create", sport)) {
    throw new OsAccessError(`You can only create programs for ${actor.sports.join(" or ")}.`);
  }

  const existingProgramId = str(formData, "programId");
  const name = reqStr(formData, "name", "Name");
  const seasonLabel = str(formData, "seasonLabel");

  const offering = await prisma.$transaction(async (tx) => {
    // Reuse the definition when the admin picked one; otherwise create it.
    const program = existingProgramId
      ? await tx.program.findUniqueOrThrow({ where: { id: existingProgramId } })
      : await tx.program.create({
          data: {
            name: str(formData, "programName") ?? name,
            programType,
            sport,
            defaultCapacity: def.defaults.capacity,
            defaultDurationMinutes: def.defaults.durationMinutes,
            requiresCoach: def.defaults.requiresCoach,
            requiredResourceType: def.defaults.requiredResourceType,
          },
        });

    return tx.offering.create({
      data: {
        programId: program.id,
        name,
        seasonLabel,
        status: "draft",
        // Seeded from the program type, then editable. Starting from the right
        // shape is most of what makes a two-minute create possible.
        scheduleKind: def.defaults.scheduleKind,
        registrationMode: def.defaults.registrationMode,
        pricingModel: def.defaults.pricingModel,
        creditRule: def.defaults.creditRule,
        defaultSessionCapacity: program.defaultCapacity ?? def.defaults.capacity,
        lowSpotThreshold: def.defaults.lowSpotThreshold,
        priceCents: program.priceCents,
        memberPriceCents: program.memberPriceCents,
        skillLevel: program.defaultSkillLevel,
        waitlistMode: "automatic",
        createdById: actor.id,
      },
    });
  });

  await auditLog(actor.id, "create_sessions", "offering", offering.id, { created: true, name });
  revalidatePath("/os/programs");
  redirect(`/os/offerings/${offering.id}`);
}
