import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "@/lib/os/permissions";
import { scopedSports } from "@/lib/os/permissions";
import { availabilityFor, type Availability } from "./availability";
import { programTypeDef } from "./types";

// ---------------------------------------------------------------------------
// Reads for the Programs home and the offering detail header.
//
// Health is computed from data the admin already has — sessions, bookings,
// coaches, Stripe pointers — not from a separate analytics store. The point is
// to answer "is anything wrong with this?" at a glance, not to be a dashboard.
// ---------------------------------------------------------------------------

export type OfferingWarning =
  | "no_coach"
  | "no_price"
  | "no_stripe"
  | "no_tax_code"
  | "no_sessions"
  | "no_description"
  | "no_image"
  | "conflict";

export const WARNING_LABELS: Record<OfferingWarning, string> = {
  no_coach: "Needs coach",
  no_price: "No price",
  no_stripe: "Stripe not connected",
  no_tax_code: "Tax setup required",
  no_sessions: "No sessions",
  no_description: "Missing public description",
  no_image: "Needs image",
  conflict: "Conflict",
};

export type OfferingSummary = {
  id: string;
  name: string;
  seasonLabel: string | null;
  status: string;
  sport: string | null;
  programType: string;
  programTypeLabel: string;
  programId: string;
  gradeMin: number | null;
  gradeMax: number | null;
  startDate: Date | null;
  endDate: Date | null;
  priceCents: number | null;
  imageUrl: string | null;
  visibleParentApp: boolean;
  visibleWebsite: boolean;
  visibleCoachApp: boolean;
  internalOnly: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  upcomingSessions: number;
  totalSessions: number;
  capacityTotal: number | null;
  booked: number;
  seats: number;
  fillRate: number | null;
  waitlistCount: number;
  warnings: OfferingWarning[];
  availability: Availability;
};

function offeringSportScope(actor: OsActor) {
  const sports = scopedSports(actor);
  if (sports === null || sports.length === 0) return {};
  return { program: { sport: { in: sports } } };
}

export type OfferingFilters = {
  view?: string;
  sport?: string;
  programType?: string;
  q?: string;
};

/// Saved views, expressed as filters rather than stored queries. Each answers a
/// question an admin actually asks standing in the building.
export const OFFERING_VIEWS = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "upcoming", label: "Upcoming" },
  { key: "registration_open", label: "Registration Open" },
  { key: "closing", label: "Closing Soon" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
] as const;

export async function listOfferings(
  actor: OsActor,
  filters: OfferingFilters
): Promise<OfferingSummary[]> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  const where: Record<string, unknown> = { ...offeringSportScope(actor) };

  switch (filters.view) {
    case "draft":
      where.status = { in: ["draft", "ready_to_publish"] };
      break;
    case "upcoming":
      where.status = "published";
      where.startDate = { gte: now };
      break;
    case "registration_open":
      where.status = "published";
      where.OR = [{ registrationClosesAt: null }, { registrationClosesAt: { gt: now } }];
      break;
    case "closing":
      where.status = "published";
      where.registrationClosesAt = { gte: now, lt: in7Days };
      break;
    case "completed":
      where.status = "completed";
      break;
    case "archived":
      where.status = "archived";
      break;
    case "active":
    case "needs_attention":
    default:
      where.status = { notIn: ["archived", "completed", "cancelled"] };
  }

  if (filters.sport) where.program = { ...(where.program as object), sport: filters.sport };
  if (filters.programType) {
    where.program = { ...(where.program as object), programType: filters.programType };
  }
  if (filters.q) {
    where.AND = [
      {
        OR: [
          { name: { contains: filters.q, mode: "insensitive" } },
          { internalName: { contains: filters.q, mode: "insensitive" } },
          { seasonLabel: { contains: filters.q, mode: "insensitive" } },
          { program: { name: { contains: filters.q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  const offerings = await prisma.offering.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      program: { select: { id: true, name: true, sport: true, programType: true, requiresCoach: true } },
      sessions: {
        where: { status: "scheduled" },
        select: {
          id: true,
          startTime: true,
          capacity: true,
          coaches: { select: { staffUserId: true } },
          _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
        },
      },
      _count: { select: { waitlist: { where: { status: { in: ["waiting", "offered"] } } } } },
    },
  });

  const summaries = offerings.map((o): OfferingSummary => {
    const def = programTypeDef(o.program.programType);
    const upcoming = o.sessions.filter((s) => s.startTime >= now);
    const seats = o.sessions.reduce((n, s) => n + s.capacity, 0);
    const booked = o.sessions.reduce((n, s) => n + s._count.bookings, 0);
    const sessionWaitlist = 0; // counted per-session below where needed

    const warnings: OfferingWarning[] = [];
    const needsCoach = o.program.requiresCoach || def.defaults.requiresCoach;
    if (needsCoach && o.sessions.some((s) => s.coaches.length === 0)) warnings.push("no_coach");
    if (o.sessions.length === 0) warnings.push("no_sessions");
    if (o.pricingModel !== "free") {
      if (o.priceCents === null || o.priceCents <= 0) warnings.push("no_price");
      else {
        if (!o.stripePriceId) warnings.push("no_stripe");
        if (!o.stripeTaxCode) warnings.push("no_tax_code");
      }
    }
    if (!o.shortDescription?.trim()) warnings.push("no_description");
    if (!o.imageUrl) warnings.push("no_image");

    // Capacity for the availability call: the offering ceiling when it has one
    // (a camp sells 40 seats overall), otherwise the next session's.
    const nextSession = upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
    const capacityForAvailability = o.capacityTotal ?? nextSession?.capacity ?? null;
    const bookedForAvailability = o.capacityTotal ? booked : (nextSession?._count.bookings ?? 0);

    return {
      id: o.id,
      name: o.name,
      seasonLabel: o.seasonLabel,
      status: o.status,
      sport: o.program.sport,
      programType: o.program.programType,
      programTypeLabel: def.label,
      programId: o.program.id,
      gradeMin: o.gradeMin,
      gradeMax: o.gradeMax,
      startDate: o.startDate,
      endDate: o.endDate,
      priceCents: o.priceCents,
      imageUrl: o.imageUrl,
      visibleParentApp: o.visibleParentApp,
      visibleWebsite: o.visibleWebsite,
      visibleCoachApp: o.visibleCoachApp,
      internalOnly: o.internalOnly,
      registrationOpensAt: o.registrationOpensAt,
      registrationClosesAt: o.registrationClosesAt,
      upcomingSessions: upcoming.length,
      totalSessions: o.sessions.length,
      capacityTotal: o.capacityTotal,
      booked,
      seats,
      fillRate: seats > 0 ? Math.round((booked / seats) * 100) : null,
      waitlistCount: o._count.waitlist + sessionWaitlist,
      warnings,
      availability: availabilityFor({
        status: o.status,
        registrationOpensAt: o.registrationOpensAt,
        registrationClosesAt: o.registrationClosesAt,
        closeWhenFull: o.closeWhenFull,
        waitlistMode: o.waitlistMode,
        lowSpotThreshold: o.lowSpotThreshold,
        capacity: capacityForAvailability,
        booked: bookedForAvailability,
      }),
    };
  });

  return filters.view === "needs_attention"
    ? summaries.filter((s) => s.warnings.length > 0)
    : summaries;
}

/// Counts for the view tabs, so a tab can show how much is behind it.
export async function offeringViewCounts(actor: OsActor) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const scope = offeringSportScope(actor);

  const [active, draft, registrationOpen, closing, completed] = await Promise.all([
    prisma.offering.count({
      where: { ...scope, status: { notIn: ["archived", "completed", "cancelled"] } },
    }),
    prisma.offering.count({ where: { ...scope, status: { in: ["draft", "ready_to_publish"] } } }),
    prisma.offering.count({
      where: {
        ...scope,
        status: "published",
        OR: [{ registrationClosesAt: null }, { registrationClosesAt: { gt: now } }],
      },
    }),
    prisma.offering.count({
      where: { ...scope, status: "published", registrationClosesAt: { gte: now, lt: in7Days } },
    }),
    prisma.offering.count({ where: { ...scope, status: "completed" } }),
  ]);

  return { active, draft, registration_open: registrationOpen, closing, completed };
}
