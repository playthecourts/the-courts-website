import Link from "next/link";
import type { ActionNeededItem } from "@/lib/parent-action-needed";
import { openBillingPortal, payBooking } from "./actions";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { displayName } from "@/lib/athlete";
import { formatGrade } from "@/lib/coach-format";

// ---------------------------------------------------------------------------
// Action Needed — THE one list of genuinely unfinished things (built by
// lib/parent-action-needed.ts). Each row says what's wrong in plain words and
// carries a CTA named for the job ("Pay $25", "Sign Waivers"). Where the app
// already has a one-tap server action (resume a booking's Checkout, open the
// Stripe billing portal) the CTA submits it directly. Nothing to do → one
// quiet line, not an empty box.
// ---------------------------------------------------------------------------
const ctaClass =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-4 font-sport text-xs font-bold tracking-wide uppercase transition-colors";

function ActionCta({ item }: { item: ActionNeededItem }) {
  const tone =
    item.tone === "urgent"
      ? "bg-orange text-white hover:bg-orange-hover"
      : "border border-near-black/15 bg-white text-near-black hover:border-orange hover:text-orange";
  const label = <>{item.cta} &rarr;</>;
  if (item.action?.kind === "payBooking") {
    return (
      <form action={payBooking.bind(null, item.action.bookingId)}>
        <button type="submit" className={`${ctaClass} ${tone}`}>
          {label}
        </button>
      </form>
    );
  }
  if (item.action?.kind === "billingPortal") {
    return (
      <form action={openBillingPortal}>
        <button type="submit" className={`${ctaClass} ${tone}`}>
          {label}
        </button>
      </form>
    );
  }
  return (
    <Link href={item.href} className={`${ctaClass} ${tone}`}>
      {label}
    </Link>
  );
}

export function ActionNeededStrip({ items }: { items: ActionNeededItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 font-body text-[13.5px] text-gray-dark">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange/10 font-display text-xs text-orange">
          &#10003;
        </span>
        You&rsquo;re all set. Nothing needs you right now.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <p className="font-sport text-[14px] font-bold tracking-wide text-orange uppercase">
        Action Needed <span className="text-gray-dark">&middot; {items.length}</span>
      </p>
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5 ${
            item.tone === "urgent" ? "border-orange/40 bg-orange/5" : "border-orange/20 bg-warm-stone"
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-black ${
                item.tone === "urgent" ? "bg-orange text-white" : "bg-orange/15 text-orange"
              }`}
              aria-hidden="true"
            >
              !
            </span>
            <div className="min-w-0">
              <p className="font-heading text-[14.5px] font-bold text-near-black">{item.title}</p>
              <p className="mt-0.5 font-body text-[13px] text-gray-dark">{item.detail}</p>
            </div>
          </div>
          <div className="pl-10 sm:pl-0">
            <ActionCta item={item} />
          </div>
        </div>
      ))}
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
      <p className="mb-2.5 font-sport text-[14px] font-bold tracking-wide text-orange uppercase">
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
                {[formatGrade(athlete.grade), athlete.nextActivity ? `Next: ${athlete.nextActivity}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Profile started"}
              </p>
            </div>
            <span className="shrink-0 font-sport text-xs font-bold tracking-wide text-gray-dark uppercase group-hover:text-orange">
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
      <p className="mb-2.5 font-sport text-[14px] font-bold tracking-wide text-orange uppercase">
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
