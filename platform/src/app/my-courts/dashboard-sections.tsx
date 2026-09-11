import Link from "next/link";
import { CourtArc } from "./court-lines";
import { ArrowGlyph } from "./glyphs";
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
      <p className="relative font-heading text-[19px] font-bold text-gray-dark md:text-[22px]">
        Hey, {firstName}.
      </p>
      <h1 className="relative mt-1 max-w-[16ch] font-display text-[21px] leading-[1.1] font-black tracking-tight text-near-black md:text-[28px]">
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
      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/my-courts/memberships"
          className="inline-flex items-center gap-2 rounded-full bg-orange px-6 py-3.5 font-sport text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-orange-hover"
        >
          View Memberships <ArrowGlyph className="h-4 w-4" />
        </Link>
        <Link
          href="/my-courts/athletes"
          className="inline-flex items-center gap-2 rounded-full border border-gray-mid bg-white px-6 py-3.5 font-sport text-sm font-bold tracking-wide text-near-black uppercase transition-colors hover:border-orange hover:text-orange"
        >
          Set Up Your Athlete &rarr;
        </Link>
      </div>
      <p className="relative mt-4 font-body text-[12.5px] text-near-black">
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
  items: { athleteName: string; message: string; href: string; cta?: string }[];
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
            {item.cta ?? "Complete"} &rarr;
          </span>
        </Link>
      ))}
    </div>
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
