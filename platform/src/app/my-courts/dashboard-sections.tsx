import Link from "next/link";
import { CourtArc } from "./court-lines";
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
// Welcome — launch-focused: pre-October 1, the dashboard's job is to get a
// family to a membership and a set-up athlete, not to imply there's a
// schedule to browse yet. Compact utility header, not a marketing hero.
// ---------------------------------------------------------------------------
export function WelcomeHero({ firstName }: { firstName: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-warm-white px-6 py-7 md:px-9 md:py-9">
      <CourtArc className="pointer-events-none absolute -top-10 -right-12 h-40 w-40 text-orange/[0.1] md:h-52 md:w-52" />
      <p className="relative font-heading text-[15px] font-bold text-gray-dark">
        Hey, {firstName}.
      </p>
      <h1 className="relative mt-1 max-w-[16ch] font-display text-[26px] leading-[1.08] font-black tracking-tight text-near-black md:text-[36px]">
        Ready to get started?
      </h1>
      <p className="relative mt-3 max-w-[52ch] font-heading text-[15px] font-bold text-near-black md:text-[16px]">
        Memberships are open now for an October 1 start.
      </p>
      <p className="relative mt-2 max-w-[54ch] font-body text-[14px] leading-relaxed text-gray-dark md:text-[15px]">
        Choose your membership, then set up your athlete profile with what they want to work on
        and anything that helps us coach them well.
      </p>
      <p className="relative mt-2 max-w-[54ch] font-body text-[14px] leading-relaxed text-gray-dark md:text-[15px]">
        Get set now, so you&rsquo;re ready to hit the court October 1.
      </p>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/my-courts/memberships"
          className="inline-flex items-center gap-2 rounded-full bg-orange px-6 py-3 font-sport text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-orange-hover"
        >
          View Memberships <ArrowGlyph className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/my-courts/athletes"
          className="font-sport text-xs font-bold tracking-wide text-near-black uppercase hover:text-orange"
        >
          Set Up Your Athlete &rarr;
        </Link>
      </div>
      <p className="relative mt-4 font-body text-[12.5px] text-gray-dark/70">
        Schedules and bookings are coming soon.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Needed — only renders when something actually needs attention.
// Warm Stone background with a single orange accent, per brand direction.
// ---------------------------------------------------------------------------
export function ActionNeededStrip({
  items,
}: {
  items: { athleteName: string; message: string; href: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        Action Needed
      </p>
      {items.map((item, i) => (
        <Link
          key={i}
          href={item.href}
          className="flex items-center justify-between gap-4 rounded-xl border border-orange/20 bg-warm-stone px-4 py-3.5 transition-colors hover:border-orange/40 md:px-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange/15 font-display text-sm font-black text-orange">
              !
            </span>
            <span className="min-w-0 font-body text-[13.5px] text-near-black">
              <span className="font-heading font-bold">{item.athleteName}</span> — {item.message}
            </span>
          </div>
          <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
            Complete &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Up Next — the most prominent module on the page, and the main reason a
// parent opens the dashboard.
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
              <Link
                href="/my-courts/schedule"
                className="mt-5 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase hover:text-white"
              >
                View Details &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative">
            <p className="font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
              Nothing Booked Yet
            </p>
            <p className="mt-1.5 max-w-[20ch] font-display text-[24px] leading-[1.05] font-black md:text-[32px]">
              Ready when you are.
            </p>
            <Link
              href="/my-courts/explore"
              className="mt-5 inline-flex items-center gap-2 font-sport text-xs font-bold tracking-wide text-orange uppercase hover:text-white"
            >
              Find a Session <ArrowGlyph className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick Actions — four equal tiles. Same height, same icon treatment, same
// padding, same title size. No descriptive copy.
// ---------------------------------------------------------------------------
const QUICK_ACTIONS = [
  { href: "/my-courts/explore", label: "Book Training", Glyph: BasketballGlyph },
  { href: "/my-courts/explore?type=camp", label: "Find a Camp", Glyph: CampGlyph },
  { href: "/my-courts/league", label: "Leagues", Glyph: LeagueGlyph },
  { href: "/my-courts/explore?type=resource", label: "Dr. Dish", Glyph: DrDishGlyph },
] as const;

export function QuickLinks() {
  return (
    <section>
      <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK_ACTIONS.map(({ href, label, Glyph }) => (
          <Link
            key={href}
            href={href}
            className="group flex h-28 flex-col items-start justify-between rounded-2xl border border-gray-mid bg-white p-4 transition-colors hover:border-orange"
          >
            <Glyph className="h-5 w-5 text-orange" />
            <span className="font-sport text-[11.5px] font-bold tracking-wide text-near-black uppercase">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Your Athletes — compact rows, not oversized avatar cards. A small circular
// avatar (photo, or brand-orange initials when there's no photo yet).
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
      <div className="flex flex-col gap-2.5">
        {athletes.map((athlete) => (
          <Link
            key={athlete.id}
            href={`/my-courts/athletes/${athlete.id}`}
            className="group flex items-center gap-3.5 rounded-2xl border border-gray-mid bg-white px-4 py-3.5 transition-colors hover:border-orange"
          >
            <AthleteAvatar athlete={athlete} photoUrl={athlete.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[15px] font-bold text-near-black">
                {displayName(athlete)}
              </p>
              <p className="mt-0.5 font-body text-[12.5px] text-gray-dark">
                {[athlete.grade ? `Grade ${athlete.grade}` : null, athlete.nextActivity ? `Next: ${athlete.nextActivity}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Profile started"}
              </p>
            </div>
            <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-gray-dark uppercase group-hover:text-orange">
              View Profile &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What's Happening at The Courts — editorial, not administrative. A small
// discovery module, capped at three items so it never competes with the
// four core dashboard questions above it.
// ---------------------------------------------------------------------------
export function WhatsHappening({
  items,
}: {
  items: { id: string; name: string; dayLabel: string; time: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
        What&rsquo;s Happening at The Courts
      </p>
      <div className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-2xl border border-gray-mid bg-white">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="font-heading text-sm font-bold text-near-black">{item.name}</p>
            <p className="shrink-0 font-body text-[13px] text-gray-dark">
              {item.dayLabel} &middot; {item.time}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
