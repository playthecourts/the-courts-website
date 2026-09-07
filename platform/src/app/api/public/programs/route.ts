import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { availabilityFor } from "@/lib/programs/availability";
import { programTypeDef, gradeRangeLabel } from "@/lib/programs/types";
import { formatCents } from "@/lib/programs/format";

// Public program feed for playthecourts.com.
//
// The marketing site renders cards from THIS, so adding a camp or an event is a
// publish in Courts OS, not an HTML edit and a deploy. Only offerings flagged
// for the website are included, and only fields that are genuinely public —
// coach notes, internal notes and staffing never appear in this response.

export const dynamic = "force-dynamic";

/// The marketing site is the only browser origin that needs this, so the
/// allow-list is explicit rather than "*". Localhost is admitted in development
/// only, so the preview page can be checked without deploying.
function corsOrigin(request: Request): string {
  const origin = request.headers.get("origin") ?? "";
  const allowed = [
    "https://playthecourts.com",
    "https://www.playthecourts.com",
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
      : []),
  ];
  return allowed.includes(origin) ? origin : "https://playthecourts.com";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sport = url.searchParams.get("sport");
  const type = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const now = new Date();

  const offerings = await prisma.offering.findMany({
    where: {
      status: "published",
      visibleWebsite: true,
      internalOnly: false,
      ...(sport ? { program: { sport } } : {}),
      ...(type ? { program: { programType: type as never } } : {}),
      // Only things a visitor could still act on.
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ startDate: "asc" }],
    take: limit,
    include: {
      program: { select: { sport: true, programType: true } },
      sessions: {
        where: { status: "scheduled", startTime: { gte: now } },
        orderBy: { startTime: "asc" },
        select: {
          startTime: true,
          endTime: true,
          capacity: true,
          _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
        },
      },
    },
  });

  const programs = offerings.map((o) => {
    const next = o.sessions[0];
    const booked = o.capacityTotal
      ? o.sessions.reduce((n, s) => n + s._count.bookings, 0)
      : (next?._count.bookings ?? 0);
    const capacity = o.capacityTotal ?? next?.capacity ?? null;

    const availability = availabilityFor(
      {
        status: o.status,
        registrationOpensAt: o.registrationOpensAt,
        registrationClosesAt: o.registrationClosesAt,
        closeWhenFull: o.closeWhenFull,
        waitlistMode: o.waitlistMode,
        lowSpotThreshold: o.lowSpotThreshold,
        capacity,
        booked,
      },
      now
    );

    return {
      id: o.id,
      name: o.name,
      season: o.seasonLabel,
      sport: o.program.sport,
      type: o.program.programType,
      typeLabel: programTypeDef(o.program.programType).label,
      shortDescription: o.shortDescription,
      fullDescription: o.fullDescription,
      grades: gradeRangeLabel(o.gradeMin, o.gradeMax),
      startDate: o.startDate,
      endDate: o.endDate,
      nextSession: next ? { start: next.startTime, end: next.endTime } : null,
      sessionCount: o.sessions.length,
      price: o.pricingModel === "free" ? "Free" : formatCents(o.priceCents),
      priceCents: o.priceCents,
      memberPriceCents: o.memberPriceCents,
      whatToBring: o.whatToBring,
      image: o.imageUrl,
      imageAlt: o.imageAltText,
      cta: o.websiteCta ?? "Register",
      // The parent-facing availability wording, so the website and the app
      // never disagree about whether something is full.
      availability: availability.state,
      availabilityLabel: availability.label,
      spotsLeft: availability.spotsLeft,
      registrationUrl: `https://app.playthecourts.com/my-courts/explore?offering=${o.id}`,
    };
  });

  return NextResponse.json(
    { generatedAt: now.toISOString(), count: programs.length, programs },
    {
      headers: {
        // Public, non-personal data. Short cache so a publish shows up quickly
        // without every visitor hitting the database.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": corsOrigin(request),
        Vary: "Origin",
      },
    }
  );
}
