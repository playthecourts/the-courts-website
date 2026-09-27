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

// "When" also offers real calendar months — "This Week"/"Anytime" answer
// "what's coming up," a month chip answers "what does October look like."
// Always starts from today (never earlier), and always runs through that
// month's actual last day, whatever it is (28-31).
const MONTH_PREFIX = "month:";

function monthRange(monthKey: string): { from: Date; to: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  const today = new Date();
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const from = monthStart > today ? monthStart : today;
  const to = new Date(Date.UTC(y, m, 1)); // exclusive — first moment of next month
  return { from, to };
}

function monthKeyFor(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// Just the current month for now — more months can join this list later
// once there's actually something to browse further out.
function upcomingMonthKeys(): string[] {
  return [monthKeyFor(new Date())];
}

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
      className={`flex min-h-[38px] items-center justify-center rounded-full border px-4 py-1.5 font-sport text-xs font-bold uppercase tracking-wide transition-colors ${
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
      <span className="w-12 shrink-0 font-sport text-xs font-bold uppercase tracking-widest text-gray-dark">
        {label}
      </span>
      {children}
    </div>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; when?: string; sport?: string; coach?: string }>;
}) {
  const { cat, when, sport, coach } = await searchParams;
  // A family that opened Checkout and abandoned it must not hold a seat
  // forever — sweep before computing availability below.
  await expireStalePendingBookings();
  const guardian = await getCurrentGuardian();
  const allAthletes = guardian.families.flatMap((fg) => fg.family.athletes);

  // Default to this week. "Everything, forever" is a browsing mode, not the
  // question someone opens the app with. A "month:2026-10" value picks a
  // real calendar month instead.
  const selectedMonthKey = when?.startsWith(MONTH_PREFIX) ? when.slice(MONTH_PREFIX.length) : null;
  const range = selectedMonthKey ? monthRange(selectedMonthKey) : (RANGES[when ?? "week"] ?? RANGES.week)();

  const unfilteredCards = await loadParentFeed(allAthletes as never, {
    category: cat,
    from: range.from,
    to: range.to,
  });

  // Sport/Performance and Coach are applied on top of the athlete/category/
  // date fetch, not pushed into loadParentFeed's own DB query — the card
  // already carries both fields, and these two facets are about narrowing
  // an already-fetched week/anytime view, not fetching a different one.
  const cards = unfilteredCards.filter((c) => {
    if (sport && c.sport !== sport) return false;
    if (coach && !c.coachNames.includes(coach)) return false;
    return true;
  });

  // Only offer a category/sport/coach chip if it would actually lead somewhere.
  const present = new Set(unfilteredCards.map((c) => c.category));
  const categoriesWithSessions = PARENT_CATEGORIES.filter((c) => present.has(c.key));

  const presentSports = [...new Set(unfilteredCards.map((c) => c.sport).filter((s): s is string => !!s))].sort();
  const presentCoaches = [...new Set(unfilteredCards.flatMap((c) => c.coachNames))].sort();

  function href(next: {
    cat?: string | null;
    when?: string | null;
    sport?: string | null;
    coach?: string | null;
  }) {
    const params = new URLSearchParams();
    const c = next.cat !== undefined ? next.cat : cat;
    const w = next.when !== undefined ? next.when : when;
    const sp = next.sport !== undefined ? next.sport : sport;
    const co = next.coach !== undefined ? next.coach : coach;
    if (c) params.set("cat", c);
    if (w) params.set("when", w);
    if (sp) params.set("sport", sp);
    if (co) params.set("coach", co);
    const qs = params.toString();
    return `/my-courts/explore${qs ? `?${qs}` : ""}`;
  }

  const who = allAthletes.map((a) => a.firstName).join(" and ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Find Your Next Rep.</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          {allAthletes.length === 0
            ? "No athletes on file yet."
            : `What ${who} can join${
                selectedMonthKey ? ` in ${monthLabel(selectedMonthKey)}` : when === "anytime" ? "" : " this week"
              }.`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
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

        {presentSports.length > 1 ? (
          <Row label="Sport">
            <Chip href={href({ sport: null })} active={!sport}>
              All
            </Chip>
            {presentSports.map((s) => (
              <Chip key={s} href={href({ sport: s })} active={sport === s}>
                {s === "All Sports" ? "Performance" : s}
              </Chip>
            ))}
          </Row>
        ) : null}

        {presentCoaches.length > 1 ? (
          <Row label="Coach">
            <Chip href={href({ coach: null })} active={!coach}>
              All
            </Chip>
            {presentCoaches.map((c) => (
              <Chip key={c} href={href({ coach: c })} active={coach === c}>
                {/* First name only — full staff names (e.g. "Justin Frank",
                    "Spencer Richardson") read as two coaches at a glance. */}
                {c.split(" ")[0]}
              </Chip>
            ))}
          </Row>
        ) : null}

        <Row label="When">
          <Chip href={href({ when: null })} active={!when}>
            This Week
          </Chip>
          <Chip href={href({ when: "anytime" })} active={when === "anytime"}>
            Anytime
          </Chip>
          {upcomingMonthKeys().map((mk) => (
            <Chip key={mk} href={href({ when: `${MONTH_PREFIX}${mk}` })} active={when === `${MONTH_PREFIX}${mk}`}>
              {monthLabel(mk)}
            </Chip>
          ))}
        </Row>
      </div>

      <details className="rounded-lg border border-gray-mid bg-white px-4 py-3">
        <summary className="cursor-pointer font-sport text-sm font-bold uppercase tracking-wide text-orange">
          Booking Policy
        </summary>
        <p className="mt-2 font-body text-sm text-gray-dark">
          Plans change, and that&rsquo;s okay. Cancel a drop-in class or Dr. Dish session at least 12 hours before
          it starts and we&rsquo;ll refund your payment or restore your credit — no questions asked. Inside that
          12-hour window, we&rsquo;re not able to offer a refund. Camps and League are final once you
          register.
        </p>
      </details>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">Nothing on the Board.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            {when === "anytime"
              ? "Nothing matches that right now."
              : selectedMonthKey
                ? `Nothing for ${who} in ${monthLabel(selectedMonthKey)}.`
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
