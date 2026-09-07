import "server-only";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Templates and cloning.
//
// The rule both share: STRUCTURE carries forward, COMMITMENTS do not.
//
// A template or a clone brings capacity, duration, eligibility, registration
// rules and visibility — the shape of the thing. It deliberately does NOT bring
// dates, coach assignments, Stripe price ids, season names or published status.
// A template that resurrects last season's price and last season's coach is
// worse than no template, because it looks correct.
// ---------------------------------------------------------------------------

export type OfferingTemplateConfig = {
  shortDescription?: string | null;
  fullDescription?: string | null;
  parentInstructions?: string | null;
  whatToBring?: string[];
  gradeMin?: number | null;
  gradeMax?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: string | null;
  skillLevel?: string | null;
  requiresTrainingPlan?: boolean;
  defaultSessionCapacity?: number | null;
  capacityTotal?: number | null;
  lowSpotThreshold?: number;
  waitlistMode?: string;
  waitlistOfferHours?: number;
  registrationMode?: string;
  closeWhenFull?: boolean;
  allowSingleDay?: boolean;
  pricingModel?: string;
  creditRule?: string;
  creditsPerBooking?: number;
  visibleParentApp?: boolean;
  visibleWebsite?: boolean;
  visibleCoachApp?: boolean;
  /// Deliberately absent: priceCents, stripe*, dates, coaches, seasonLabel.
};

/// Everything a template is allowed to carry, extracted from a live offering.
export async function captureTemplate(
  offeringId: string,
  name: string,
  createdById: string
) {
  const o = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { program: { select: { programType: true, sport: true } } },
  });

  const config: OfferingTemplateConfig = {
    shortDescription: o.shortDescription,
    fullDescription: o.fullDescription,
    parentInstructions: o.parentInstructions,
    whatToBring: o.whatToBring,
    gradeMin: o.gradeMin,
    gradeMax: o.gradeMax,
    ageMin: o.ageMin,
    ageMax: o.ageMax,
    gender: o.gender,
    skillLevel: o.skillLevel,
    requiresTrainingPlan: o.requiresTrainingPlan,
    defaultSessionCapacity: o.defaultSessionCapacity,
    capacityTotal: o.capacityTotal,
    lowSpotThreshold: o.lowSpotThreshold,
    waitlistMode: o.waitlistMode,
    waitlistOfferHours: o.waitlistOfferHours,
    registrationMode: o.registrationMode,
    closeWhenFull: o.closeWhenFull,
    allowSingleDay: o.allowSingleDay,
    pricingModel: o.pricingModel,
    creditRule: o.creditRule,
    creditsPerBooking: o.creditsPerBooking,
    visibleParentApp: o.visibleParentApp,
    visibleWebsite: o.visibleWebsite,
    visibleCoachApp: o.visibleCoachApp,
  };

  return prisma.offeringTemplate.create({
    data: {
      name,
      programType: o.program.programType,
      sport: o.program.sport,
      config: config as object,
      createdById,
    },
  });
}

export async function createFromTemplate(
  templateId: string,
  input: { programId: string; name: string; seasonLabel: string | null; createdById: string }
) {
  const template = await prisma.offeringTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const config = template.config as OfferingTemplateConfig;

  return prisma.offering.create({
    data: {
      programId: input.programId,
      name: input.name,
      seasonLabel: input.seasonLabel,
      status: "draft",
      templateId: template.id,
      createdById: input.createdById,
      ...structuralFields(config),
    },
  });
}

/// Clone Season: "Fall 2026 Basketball League" → "Winter 2027 Basketball League".
///
/// The new offering shares the PROGRAM (same definition, new season) and copies
/// structure only. Everything that must be re-decided is left blank and shows up
/// as a publish blocker, which is what forces the admin to review dates, price,
/// coaches and Stripe before anything goes live.
export async function cloneOffering(
  offeringId: string,
  input: { name: string; seasonLabel: string | null; createdById: string }
) {
  const source = await prisma.offering.findUniqueOrThrow({ where: { id: offeringId } });

  const config: OfferingTemplateConfig = {
    shortDescription: source.shortDescription,
    fullDescription: source.fullDescription,
    parentInstructions: source.parentInstructions,
    whatToBring: source.whatToBring,
    gradeMin: source.gradeMin,
    gradeMax: source.gradeMax,
    ageMin: source.ageMin,
    ageMax: source.ageMax,
    gender: source.gender,
    skillLevel: source.skillLevel,
    requiresTrainingPlan: source.requiresTrainingPlan,
    defaultSessionCapacity: source.defaultSessionCapacity,
    capacityTotal: source.capacityTotal,
    lowSpotThreshold: source.lowSpotThreshold,
    waitlistMode: source.waitlistMode,
    waitlistOfferHours: source.waitlistOfferHours,
    registrationMode: source.registrationMode,
    closeWhenFull: source.closeWhenFull,
    allowSingleDay: source.allowSingleDay,
    pricingModel: source.pricingModel,
    creditRule: source.creditRule,
    creditsPerBooking: source.creditsPerBooking,
    visibleParentApp: source.visibleParentApp,
    visibleWebsite: source.visibleWebsite,
    visibleCoachApp: source.visibleCoachApp,
  };

  return prisma.offering.create({
    data: {
      programId: source.programId,
      name: input.name,
      seasonLabel: input.seasonLabel,
      status: "draft",
      clonedFromOfferingId: source.id,
      createdById: input.createdById,
      // Carried across so the admin doesn't retype the internal reference copy.
      coachNotes: source.coachNotes,
      internalNotes: source.internalNotes,
      imageUrl: source.imageUrl,
      imageAltText: source.imageAltText,
      websiteCta: source.websiteCta,
      ...structuralFields(config),
      // Explicitly NOT carried: dates, sessions, coach assignments, prices,
      // Stripe ids, registration windows, publish state. Each is a decision the
      // new season has to make for itself, and each shows as a publish blocker
      // until it does.
    },
  });
}

function structuralFields(c: OfferingTemplateConfig) {
  return {
    shortDescription: c.shortDescription ?? null,
    fullDescription: c.fullDescription ?? null,
    parentInstructions: c.parentInstructions ?? null,
    whatToBring: c.whatToBring ?? [],
    gradeMin: c.gradeMin ?? null,
    gradeMax: c.gradeMax ?? null,
    ageMin: c.ageMin ?? null,
    ageMax: c.ageMax ?? null,
    gender: c.gender ?? null,
    skillLevel: (c.skillLevel as never) ?? null,
    requiresTrainingPlan: c.requiresTrainingPlan ?? false,
    defaultSessionCapacity: c.defaultSessionCapacity ?? null,
    capacityTotal: c.capacityTotal ?? null,
    lowSpotThreshold: c.lowSpotThreshold ?? 3,
    waitlistMode: (c.waitlistMode as never) ?? "automatic",
    waitlistOfferHours: c.waitlistOfferHours ?? 24,
    registrationMode: (c.registrationMode as never) ?? "session",
    closeWhenFull: c.closeWhenFull ?? false,
    allowSingleDay: c.allowSingleDay ?? false,
    pricingModel: (c.pricingModel as never) ?? "per_session",
    creditRule: (c.creditRule as never) ?? "separate_payment",
    creditsPerBooking: c.creditsPerBooking ?? 1,
    visibleParentApp: c.visibleParentApp ?? true,
    visibleWebsite: c.visibleWebsite ?? false,
    visibleCoachApp: c.visibleCoachApp ?? true,
  };
}

/// What a clone deliberately left blank — rendered on the new offering so the
/// admin sees the review list rather than discovering it at publish time.
export const CLONE_REVIEW_ITEMS = [
  "Dates and sessions",
  "Price and Stripe setup",
  "Coach assignments",
  "Registration open/close dates",
  "Grade or age range",
] as const;
