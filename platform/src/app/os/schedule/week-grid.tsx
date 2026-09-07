"use client";

import Link from "next/link";
import { useState } from "react";
import type { ScheduleCard, ClosureBand } from "@/lib/programs/schedule-view";

// A real time grid: days across, time down, cards positioned by their actual
// start and duration. Density is the point — this is an admin tool, so a card
// carries time, program, coach, court and fill in the space a marketing tile
// would spend on a photograph.

const DAY_START_MIN = 6 * 60;   // 6 AM
const DAY_END_MIN = 22 * 60;    // 10 PM
const PX_PER_MIN = 1.1;         // ~66px per hour: a 60-min session is legible.
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;

const SPORT_ACCENT: Record<string, string> = {
  Basketball: "border-l-orange",
  Volleyball: "border-l-info",
  "Multi-Sport": "border-l-success",
  General: "border-l-neutral",
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(iso)).replace(":00", "");
}

export function WeekGrid({
  weekStartIso,
  cards,
  closures,
}: {
  weekStartIso: string;
  cards: ScheduleCard[];
  closures: ClosureBand[];
}) {
  const [selected, setSelected] = useState<ScheduleCard | null>(null);
  const start = new Date(weekStartIso);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const hours = Array.from(
    { length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 },
    (_, i) => DAY_START_MIN + i * 60
  );

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-mid bg-white">
        <div className="min-w-[880px]">
          {/* Day headers */}
          <div className="grid border-b border-gray-mid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div />
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const isToday = key === todayKey;
              return (
                <div key={key} className={`border-l border-gray-mid px-2 py-2 text-center ${isToday ? "bg-orange/5" : ""}`}>
                  <p className={`os-eyebrow ${isToday ? "text-orange" : "text-neutral"}`}>
                    {new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d)}
                  </p>
                  <p className={`os-num text-sm ${isToday ? "text-orange" : "text-near-black"}`}>
                    {d.getUTCDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {hours.map((m) => (
                <div
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-right"
                  style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
                >
                  <span className="os-eyebrow text-neutral">
                    {m % 720 === 0 ? 12 : Math.floor(m / 60) % 12}
                    {m >= 720 ? "p" : "a"}
                  </span>
                </div>
              ))}
            </div>

            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const dayCards = cards.filter((c) => c.dayKey === key);
              const dayClosures = closures.filter(
                (b) => new Date(b.start) < new Date(`${key}T23:59:59Z`) && new Date(b.end) > new Date(`${key}T00:00:00Z`)
              );

              // Side-by-side layout for cards that overlap in time.
              const laid = layout(dayCards);

              return (
                <div
                  key={key}
                  className={`relative border-l border-gray-mid ${key === todayKey ? "bg-orange/[0.03]" : ""}`}
                  style={{ height: GRID_HEIGHT }}
                >
                  {hours.map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 border-t border-gray-mid/50"
                      style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
                    />
                  ))}

                  {/* Facility closures sit behind sessions — the reason a slot
                      that looks free isn't actually bookable. */}
                  {dayClosures.map((b) => {
                    const s = Math.max(DAY_START_MIN, minutesOfDay(b.start, key));
                    const e = Math.min(DAY_END_MIN, minutesOfDay(b.end, key, true));
                    if (e <= s) return null;
                    return (
                      <div
                        key={b.id}
                        title={`${b.resourceName ?? "Facility"} closed — ${b.reason.replace(/_/g, " ")}`}
                        className="absolute inset-x-0.5 rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,var(--color-gray-mid)_5px,var(--color-gray-mid)_10px)] opacity-60"
                        style={{ top: (s - DAY_START_MIN) * PX_PER_MIN, height: (e - s) * PX_PER_MIN }}
                      >
                        <span className="os-eyebrow block px-1 pt-0.5 text-gray-dark">
                          {b.resourceName ?? "Facility"} closed
                        </span>
                      </div>
                    );
                  })}

                  {laid.map(({ card, col, cols }) => {
                    const top = (card.startMinute - DAY_START_MIN) * PX_PER_MIN;
                    const height = Math.max(26, card.durationMinutes * PX_PER_MIN - 2);
                    const cancelled = card.status === "cancelled";
                    const isDraft = card.offeringStatus && card.offeringStatus !== "published";
                    const full = card.booked >= card.capacity;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelected(card)}
                        style={{
                          top,
                          height,
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                        }}
                        className={`absolute overflow-hidden rounded border border-gray-mid border-l-[3px] bg-white px-1.5 py-1 text-left transition-shadow hover:z-10 hover:shadow-md ${
                          SPORT_ACCENT[card.sport ?? "General"] ?? "border-l-neutral"
                        } ${cancelled ? "opacity-45 line-through" : ""} ${isDraft ? "border-dashed" : ""}`}
                      >
                        <p className="os-num text-[10px] leading-tight text-neutral">
                          {fmtTime(card.start)}–{fmtTime(card.end)}
                        </p>
                        <p className="os-heading truncate text-[11px] leading-tight text-near-black">
                          {card.title ?? card.offeringName}
                        </p>
                        {height > 44 ? (
                          <p className="truncate text-[10px] leading-tight text-gray-dark">
                            {[card.coachNames[0], card.resourceNames[0]].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        {height > 58 ? (
                          <p className={`os-num text-[10px] leading-tight ${full ? "text-danger" : "text-neutral"}`}>
                            {card.booked}/{card.capacity}
                            {card.waitlist > 0 ? ` · ${card.waitlist} waiting` : ""}
                            {isDraft ? " · draft" : ""}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.offeringName}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-md rounded-xl border border-gray-mid bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="os-eyebrow text-orange">
              {[selected.sport, selected.programType.replace(/_/g, " ")].filter(Boolean).join(" · ")}
            </p>
            <p className="os-display mt-1 text-xl text-near-black">{selected.title ?? selected.offeringName}</p>
            <dl className="mt-4 flex flex-col gap-2 text-sm">
              {[
                ["When", `${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(selected.start))} · ${fmtTime(selected.start)}–${fmtTime(selected.end)}`],
                ["Court", selected.resourceNames.join(" + ") || "None assigned"],
                ["Staff", selected.coachNames.join(", ") || "None assigned"],
                ["Registered", `${selected.booked} of ${selected.capacity}${selected.waitlist ? ` · ${selected.waitlist} waiting` : ""}`],
                ["Status", selected.status === "cancelled" ? "Cancelled" : (selected.offeringStatus ?? "—").replace(/_/g, " ")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-mid/60 pb-1.5">
                  <dt className="os-eyebrow text-neutral">{k}</dt>
                  <dd className="text-right text-gray-dark">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex gap-2">
              {selected.offeringId ? (
                <Link
                  href={`/os/offerings/${selected.offeringId}?tab=schedule`}
                  className="os-heading inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-orange px-4 text-sm uppercase tracking-wide text-white hover:bg-orange-hover"
                >
                  Open Program
                </Link>
              ) : null}
              <button type="button" onClick={() => setSelected(null)} className="os-heading inline-flex min-h-11 items-center rounded-lg border border-gray-mid px-4 text-sm uppercase tracking-wide">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function minutesOfDay(iso: string, dayKey: string, isEnd = false) {
  const d = new Date(iso);
  const key = d.toISOString().slice(0, 10);
  if (key < dayKey) return isEnd ? DAY_END_MIN : DAY_START_MIN;
  if (key > dayKey) return isEnd ? DAY_END_MIN : DAY_START_MIN;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/// Overlapping sessions share the column rather than stacking on top of each
/// other — two courts running at 5pm must both be visible.
function layout(cards: ScheduleCard[]) {
  const sorted = [...cards].sort((a, b) => a.startMinute - b.startMinute);
  const out: { card: ScheduleCard; col: number; cols: number }[] = [];
  let cluster: ScheduleCard[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columns: ScheduleCard[][] = [];
    for (const c of cluster) {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (last.startMinute + last.durationMinutes <= c.startMinute) {
          col.push(c);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([c]);
    }
    columns.forEach((col, i) =>
      col.forEach((card) => out.push({ card, col: i, cols: columns.length }))
    );
    cluster = [];
    clusterEnd = -1;
  };

  for (const c of sorted) {
    if (cluster.length > 0 && c.startMinute >= clusterEnd) flush();
    cluster.push(c);
    clusterEnd = Math.max(clusterEnd, c.startMinute + c.durationMinutes);
  }
  flush();
  return out;
}
