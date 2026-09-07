import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { loadParentFeed } from "@/lib/programs/parent-feed";
import { CREATE_PICKER_ORDER, PROGRAM_TYPE_LABELS } from "@/lib/programs/types";
import { OfferingSessionCard } from "./offering-session-card";

// Everything here comes from published Offerings. There is no separate parent
// catalog to maintain: an admin publishes once in Courts OS and this reads the
// same row. A draft cannot appear, because loadParentFeed's visibility rule is
// the only door in.

const DATE_RANGES: Record<string, () => { from: Date; to?: Date }> = {
  today: () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { from: now, to: new Date(start.getTime() + 86_400_000) };
  },
  tomorrow: () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return { from: start, to: new Date(start.getTime() + 86_400_000) };
  },
  week: () => ({ from: new Date(), to: new Date(Date.now() + 7 * 86_400_000) }),
  weekend: () => {
    const now = new Date();
    const daysUntilSat = (6 - now.getUTCDay() + 7) % 7;
    const sat = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSat)
    );
    return { from: now, to: new Date(sat.getTime() + 2 * 86_400_000) };
  },
};
const DATE_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This Week",
  weekend: "This Weekend",
};

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`min-h-[36px] rounded-full border px-4 py-1.5 font-sport text-xs font-bold uppercase tracking-wide ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-mid bg-white text-gray-dark hover:border-orange"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; type?: string; when?: string }>;
}) {
  const { sport, type, when } = await searchParams;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  const range = when && DATE_RANGES[when] ? DATE_RANGES[when]() : { from: new Date() };
  const cards = await loadParentFeed(athletes as never, {
    sport,
    programType: type,
    from: range.from,
    to: range.to,
  });

  // Only offer filters that lead somewhere, drawn from what's actually published.
  const availableSports = await prisma.offering.findMany({
    where: { status: "published", visibleParentApp: true, internalOnly: false },
    select: { program: { select: { sport: true } } },
    distinct: ["programId"],
  });
  const sports = [...new Set(availableSports.map((o) => o.program.sport).filter(Boolean))] as string[];
  const availableTypes = [...new Set(cards.map((c) => c.programType))];

  function chipHref(next: { sport?: string; type?: string; when?: string }) {
    const params = new URLSearchParams();
    const s = next.sport !== undefined ? next.sport : sport;
    const t = next.type !== undefined ? next.type : type;
    const w = next.when !== undefined ? next.when : when;
    if (s) params.set("sport", s);
    if (t) params.set("type", t);
    if (w) params.set("when", w);
    const qs = params.toString();
    return `/my-courts/explore${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Find Your Next Rep.</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          {athletes.length === 0
            ? "No athletes on file yet."
            : `Showing what ${athletes.map((a) => a.firstName).join(" and ")} can join.`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Chip href={chipHref({ sport: undefined })} active={!sport}>All Sports</Chip>
          {sports.map((s) => (
            <Chip key={s} href={chipHref({ sport: s })} active={sport === s}>{s}</Chip>
          ))}
        </div>
        {availableTypes.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Chip href={chipHref({ type: undefined })} active={!type}>All Types</Chip>
            {CREATE_PICKER_ORDER.filter((t) => availableTypes.includes(t)).map((t) => (
              <Chip key={t} href={chipHref({ type: t })} active={type === t}>
                {PROGRAM_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Chip href={chipHref({ when: undefined })} active={!when}>Anytime</Chip>
          {Object.entries(DATE_LABELS).map(([v, l]) => (
            <Chip key={v} href={chipHref({ when: v })} active={when === v}>{l}</Chip>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">Nothing on the Board.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            Nothing matches that right now. Try another sport or a wider date range.
          </p>
          <Link
            href="/my-courts/explore"
            className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
          >
            Clear Filters
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <OfferingSessionCard key={card.sessionId} card={JSON.parse(JSON.stringify(card))} />
          ))}
        </div>
      )}
    </div>
  );
}
