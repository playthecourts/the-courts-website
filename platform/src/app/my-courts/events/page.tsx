import { getCurrentGuardian } from "@/lib/dal";
import { loadParentFeed } from "@/lib/programs/parent-feed";
import { expireStalePendingBookings } from "@/lib/booking";
import { GroupedOfferingCard, type Card } from "../explore/offering-session-card";

export const dynamic = "force-dynamic";

// One-off single-day events (Early Release, Day Off/Game On) — same real
// Offerings as events.html on the marketing site. These are registrationMode
// "session" under the shared "Camps" Program, same as Explore's "camps"
// category, but Explore's category filter also only ever returns
// registrationMode "session" rows (see loadParentFeed) — the multi-day/
// whole-week camps live on their own page (my-courts/camps) instead. So
// filtering to category "camps" here surfaces exactly the single-day events
// and nothing else, with zero duplicated booking/pricing logic.

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

export default async function EventsPage() {
  await expireStalePendingBookings();
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  const cards = await loadParentFeed(athletes as never, { category: "camps", from: new Date() });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Events</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          One-day breaks from the regular schedule — Early Release days, Day Off/Game On, and more.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-gray-mid bg-white p-6 text-center md:p-8">
          <p className="font-display text-lg font-black text-black md:text-xl">Nothing Scheduled Yet</p>
          <p className="mx-auto mt-2 max-w-[46ch] font-body text-sm text-gray-dark">
            No upcoming one-day events right now — check back soon.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groupByOfferingAndDay(cards.map((c) => JSON.parse(JSON.stringify(c)) as Card)).map((group) => (
            <GroupedOfferingCard key={`${group[0].offeringId}-${group[0].startTime.slice(0, 10)}`} cards={group} />
          ))}
        </div>
      )}
    </div>
  );
}
