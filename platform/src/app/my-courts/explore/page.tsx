import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { loadParentFeed } from "@/lib/programs/parent-feed";
import { PARENT_CATEGORIES } from "@/lib/programs/types";
import { expireStalePendingBookings } from "@/lib/booking";
import { GroupedOfferingCard, type Card } from "./offering-session-card";

// Explore, filtered the way a parent thinks.
//
// The athlete is the primary filter, because picking a child already answers
// sport, grade eligibility and most of "is this relevant to us" in one tap. The
// 12 admin program types collapse into five buckets families recognise, and the
// default is this week — the question people actually arrive with.

const RANGES: Record<string, () => { from: Date; to?: Date }> = {
  week: () => ({ from: new Date(), to: new Date(Date.now() + 7 * 86_400_000) }),
  anytime: () => ({ from: new Date() }),
};

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`min-h-[38px] rounded-full border px-4 py-1.5 font-sport text-xs font-bold uppercase tracking-wide transition-colors ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-mid bg-white text-gray-dark hover:border-orange"
      }`}
    >
      {children}
    </Link>
  );
}

// Same offering, same calendar day (Dr. Dish's 30-min self-serve slots,
// mainly) collapse into one group so the list reads as one block per day
// instead of a wall of near-identical cards — booking itself is untouched,
// each slot is still its own session underneath.
function groupByOfferingAndDay(cards: Card[]): Card[][] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const day = card.startTime.slice(0, 10);
    const key = `${card.offeringId}-${day}`;
    const existing = groups.get(key);
    if (existing) existing.push(card);
    else groups.set(key, [card]);
  }
  return [...groups.values()];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
        {label}
      </span>
      {children}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string; cat?: string; when?: string }>;
}) {
  const { athlete: athleteParam, cat, when } = await searchParams;
  // A family that opened Checkout and abandoned it must not hold a seat
  // forever — sweep before computing availability below.
  await expireStalePendingBookings();
  const guardian = await getCurrentGuardian();
  const allAthletes = guardian.families.flatMap((fg) => fg.family.athletes);

  // Default to this week. "Everything, forever" is a browsing mode, not the
  // question someone opens the app with.
  const range = (RANGES[when ?? "week"] ?? RANGES.week)();

  const selected =
    athleteParam && allAthletes.some((a) => a.id === athleteParam)
      ? allAthletes.filter((a) => a.id === athleteParam)
      : allAthletes;

  const cards = await loadParentFeed(selected as never, {
    category: cat,
    from: range.from,
    to: range.to,
  });

  // Only offer a category chip if it would actually lead somewhere.
  const present = new Set(cards.map((c) => c.category));
  const categoriesWithSessions = PARENT_CATEGORIES.filter((c) => present.has(c.key));

  function href(next: { athlete?: string | null; cat?: string | null; when?: string | null }) {
    const params = new URLSearchParams();
    const a = next.athlete !== undefined ? next.athlete : athleteParam;
    const c = next.cat !== undefined ? next.cat : cat;
    const w = next.when !== undefined ? next.when : when;
    if (a) params.set("athlete", a);
    if (c) params.set("cat", c);
    if (w) params.set("when", w);
    const qs = params.toString();
    return `/my-courts/explore${qs ? `?${qs}` : ""}`;
  }

  const who =
    selected.length === 1
      ? selected[0].firstName
      : allAthletes.map((a) => a.firstName).join(" and ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Find Your Next Rep.</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          {allAthletes.length === 0
            ? "No athletes on file yet."
            : `What ${who} can join${when === "anytime" ? "" : " this week"}.`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* The athlete is the primary filter — one tap that means something. */}
        {allAthletes.length > 1 ? (
          <Row label="Who">
            {allAthletes.map((a) => (
              <Chip key={a.id} href={href({ athlete: a.id })} active={athleteParam === a.id}>
                {a.firstName}
              </Chip>
            ))}
            <Chip href={href({ athlete: null })} active={!athleteParam}>
              Both
            </Chip>
          </Row>
        ) : null}

        {categoriesWithSessions.length > 1 ? (
          <Row label="What">
            <Chip href={href({ cat: null })} active={!cat}>
              All
            </Chip>
            {categoriesWithSessions.map((c) => (
              <Chip key={c.key} href={href({ cat: c.key })} active={cat === c.key}>
                {c.label}
              </Chip>
            ))}
          </Row>
        ) : null}

        <Row label="When">
          <Chip href={href({ when: null })} active={when !== "anytime"}>
            This Week
          </Chip>
          <Chip href={href({ when: "anytime" })} active={when === "anytime"}>
            Anytime
          </Chip>
        </Row>
      </div>

      <details className="rounded-lg border border-gray-mid bg-white px-4 py-3">
        <summary className="cursor-pointer font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">
          Booking Policy
        </summary>
        <p className="mt-2 font-body text-sm text-gray-dark">
          Plans change, and that&rsquo;s okay. Cancel a drop-in class or Dr. Dish session at least 12 hours before
          it starts and we&rsquo;ll refund your payment or restore your credit — no questions asked. Inside that
          12-hour window, we&rsquo;re not able to offer a refund. Camps and Fall League are final once you
          register.
        </p>
      </details>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">Nothing on the Board.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            {when === "anytime"
              ? "Nothing matches that right now."
              : `Nothing for ${who} this week.`}
          </p>
          {when !== "anytime" ? (
            <Link
              href={href({ when: "anytime", cat: null })}
              className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
            >
              Look Further Out
            </Link>
          ) : (
            <Link
              href="/my-courts/explore"
              className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
            >
              Clear Filters
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groupByOfferingAndDay(cards.map((c) => JSON.parse(JSON.stringify(c)) as Card)).map((group) => (
            <GroupedOfferingCard key={`${group[0].offeringId}-${group[0].sessionId}`} cards={group} />
          ))}
        </div>
      )}
    </div>
  );
}
