import Link from "next/link";
import { CourtArc, CourtSeam } from "./court-lines";
import {
  ArrowGlyph,
  BasketballGlyph,
  CampGlyph,
  DrDishGlyph,
  LeagueGlyph,
  VolleyballGlyph,
} from "./glyphs";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { displayName } from "@/lib/athlete";

// ---------------------------------------------------------------------------
// Welcome — the first thing a parent sees. Light, editorial, oversized type.
// Deliberately not dark: the one bold panel on this page is Up Next, so the
// welcome header stays warm and open rather than competing with it.
// ---------------------------------------------------------------------------
export function WelcomeHero({ firstName }: { firstName: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-warm-white px-6 py-9 md:px-10 md:py-14">
      <CourtArc className="pointer-events-none absolute -top-12 -right-14 h-56 w-56 text-orange/[0.12] md:h-72 md:w-72" />
      <p className="relative font-heading text-[15px] font-bold text-gray-dark md:text-base">
        Hey, {firstName}.
      </p>
      <h1 className="relative mt-1 max-w-[16ch] font-display text-[34px] leading-[1.02] font-black tracking-tight text-near-black md:text-[52px]">
        Ready for the next one?
      </h1>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Needed — a compact, elegant strip per item. Amber/warning tokens,
// never the danger palette; this is a nudge, not an error. Renders nothing
// once the caller passes an empty list, so the section disappears entirely.
// ---------------------------------------------------------------------------
export function ActionNeededStrip({
  items,
}: {
  items: { athleteName: string; message: string; href: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sport text-[13px] font-bold tracking-wide text-warning uppercase">
        Action Needed
      </p>
      {items.map((item, i) => (
        <Link
          key={i}
          href={item.href}
          className="flex items-center justify-between gap-4 rounded-xl border border-warning/25 bg-warning-bg px-4 py-3.5 transition-colors hover:border-warning/50 md:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 font-display text-sm font-black text-warning">
              !
            </span>
            <span className="min-w-0 font-body text-[13.5px] text-near-black">
              <span className="font-heading font-bold">{item.athleteName}</span> — {item.message}
            </span>
          </div>
          <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-warning uppercase">
            Complete &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Up Next — the most prominent module on the page. One bold dark panel; a
// deliberate, contained use of near-black rather than a page-wide tone.
// ---------------------------------------------------------------------------
function SportGlyph({ sport, className }: { sport: string | null | undefined; className?: string }) {
  if ((sport ?? "").toLowerCase().startsWith("v")) return <VolleyballGlyph className={className} />;
  return <BasketballGlyph className={className} />;
}

export function UpNextCard({
  nextUp,
}: {
  nextUp: {
    programName: string;
    sport: string | null;
    athleteName: string;
    coachName: string | null;
    dayLabel: string;
    dayNumber: string;
    time: string;
    location: string | null;
  } | null;
}) {
  return (
    <section>
      <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        Up Next
      </p>
      <div className="relative overflow-hidden rounded-2xl bg-near-black p-6 text-white md:p-8">
        <CourtArc className="pointer-events-none absolute -right-12 -bottom-16 h-64 w-64 text-white/[0.06] md:h-80 md:w-80" />
        {nextUp ? (
          <div className="relative flex items-start gap-4 md:gap-6">
            <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 px-3.5 py-2.5 text-center md:px-5 md:py-4">
              <span className="font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                {nextUp.dayLabel}
              </span>
              <span className="font-display text-[30px] leading-none font-black md:text-4xl">
                {nextUp.dayNumber}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-orange">
                <SportGlyph sport={nextUp.sport} className="h-4 w-4" />
                <span className="font-sport text-[11px] font-bold tracking-wide uppercase">
                  {nextUp.sport ?? "Training"}
                </span>
              </div>
              <h2 className="mt-1 font-display text-[22px] leading-[1.05] font-black md:text-[30px]">
                {nextUp.programName}
              </h2>
              <p className="mt-2 font-body text-[13.5px] text-white/70 md:text-[15px]">
                {nextUp.athleteName}
                {nextUp.coachName ? ` · Coach ${nextUp.coachName}` : ""} · {nextUp.time}
              </p>
              {nextUp.location && (
                <p className="font-body text-[13.5px] text-white/45 md:text-[15px]">{nextUp.location}</p>
              )}
              <div className="mt-5 flex items-center gap-5">
                <Link
                  href="/my-courts/schedule"
                  className="font-sport text-xs font-bold tracking-wide text-orange uppercase hover:text-white"
                >
                  View Details &rarr;
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="max-w-[20ch] font-display text-[24px] leading-[1.05] font-black md:text-[32px]">
              Nothing on the calendar yet.
            </p>
            <p className="mt-1.5 font-body text-[15px] text-white/70">Let&rsquo;s change that.</p>
            <Link
              href="/my-courts/explore"
              className="mt-5 inline-flex items-center gap-2 font-sport text-xs font-bold tracking-wide text-orange uppercase hover:text-white"
            >
              Find Training <ArrowGlyph className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Explore — inspirational, not administrative. Room for rotating featured
// programming later without a redesign: pass `featured` and it renders as a
// small eyebrow line inside the same panel.
// ---------------------------------------------------------------------------
export function ExplorePanel({ featured }: { featured?: string | null }) {
  return (
    <Link
      href="/my-courts/explore"
      className="group relative block overflow-hidden rounded-2xl bg-warm-stone px-6 py-8 transition-colors hover:bg-orange/10 md:px-10 md:py-11"
    >
      <CourtSeam className="pointer-events-none absolute inset-0 h-full w-full text-orange/[0.14]" />
      <div className="relative">
        {featured && (
          <p className="mb-2 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
            Featured &middot; {featured}
          </p>
        )}
        <h2 className="max-w-[18ch] font-display text-[24px] leading-[1.05] font-black text-near-black md:text-[32px]">
          Find Something to Play.
        </h2>
        <p className="mt-2 max-w-[36ch] font-body text-[14px] text-gray-dark md:text-[15px]">
          Training, camps, leagues, and more — all in one place.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 font-sport text-xs font-bold tracking-wide text-orange uppercase">
          Explore Programs
          <ArrowGlyph className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Your Athletes — the athlete is the center of the experience. Horizontal
// scroll on mobile, a clean row on desktop; one editorial card per athlete.
// ---------------------------------------------------------------------------
export function AthleteRow({
  athletes,
}: {
  athletes: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    grade: string | null;
    sports: string[];
    photoUrl: string | null;
    nextActivity: string | null;
  }[];
}) {
  if (athletes.length === 0) return null;
  return (
    <section>
      <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        Your Athletes
      </p>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
        {athletes.map((athlete) => (
          <Link
            key={athlete.id}
            href={`/my-courts/athletes/${athlete.id}`}
            className="group flex w-[76%] shrink-0 snap-start flex-col items-start gap-3 rounded-2xl border border-gray-mid bg-white p-5 transition-colors hover:border-orange md:w-auto"
          >
            <AthleteAvatar athlete={athlete} photoUrl={athlete.photoUrl} size="xl" />
            <div className="min-w-0">
              <p className="font-display text-[19px] font-black text-near-black">
                {displayName(athlete)}
              </p>
              <p className="mt-0.5 font-body text-[13px] text-gray-dark">
                {[athlete.grade ? `Grade ${athlete.grade}` : null, athlete.sports.join(" · ") || null]
                  .filter(Boolean)
                  .join(" · ") || "Profile started"}
              </p>
              {athlete.nextActivity && (
                <p className="mt-1.5 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                  Next: {athlete.nextActivity}
                </p>
              )}
            </div>
            <span className="mt-1 font-sport text-[11px] font-bold tracking-wide text-gray-dark uppercase group-hover:text-orange">
              View Profile &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick Links — four destinations, deliberately not four identical buttons.
// Book Training carries more visual weight because it's the most frequent
// action; the rest share a lighter, compact treatment with their own icon.
// ---------------------------------------------------------------------------
export function QuickLinks() {
  return (
    <section>
      <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        Get Going
      </p>
      <div className="flex flex-col gap-3">
        <Link
          href="/my-courts/explore"
          className="group flex items-center justify-between gap-4 rounded-2xl bg-near-black px-6 py-6 transition-colors hover:bg-charcoal"
        >
          <div>
            <BasketballGlyph className="h-7 w-7 text-orange" />
            <p className="mt-3 font-display text-[20px] font-black text-white">Book Training</p>
            <p className="mt-0.5 font-body text-[13px] text-white/55">Group sessions, open this week</p>
          </div>
          <ArrowGlyph className="h-5 w-5 shrink-0 text-white/50 transition-transform group-hover:translate-x-1 group-hover:text-orange" />
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/my-courts/explore?type=camp"
            className="flex flex-col items-start gap-2.5 rounded-2xl bg-warm-stone px-4 py-5 transition-colors hover:bg-orange/15"
          >
            <CampGlyph className="h-5 w-5 text-orange" />
            <span className="font-sport text-[11px] font-bold tracking-wide text-near-black uppercase">
              Find a Camp
            </span>
          </Link>
          <Link
            href="/my-courts/league"
            className="flex flex-col items-start gap-2.5 rounded-2xl border border-gray-mid bg-white px-4 py-5 transition-colors hover:border-orange"
          >
            <LeagueGlyph className="h-5 w-5 text-near-black" />
            <span className="font-sport text-[11px] font-bold tracking-wide text-near-black uppercase">
              Leagues
            </span>
          </Link>
          <Link
            href="/my-courts/explore?type=resource"
            className="flex flex-col items-start gap-2.5 rounded-2xl border border-gray-mid bg-white px-4 py-5 transition-colors hover:border-orange"
          >
            <DrDishGlyph className="h-5 w-5 text-near-black" />
            <span className="font-sport text-[11px] font-bold tracking-wide text-near-black uppercase">
              Dr. Dish
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
