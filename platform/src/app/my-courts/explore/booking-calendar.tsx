"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GroupedOfferingCard, type Card } from "./offering-session-card";

// The calendar sidebar does two different jobs, kept visually separate on
// purpose: the grid answers "what's available this month" (every bookable
// session, not just this family's), and the fixed panel below it answers
// "what have I ALREADY got going on" (read-only — cancelling, the +Google
// link, and payment-status badges all live on /my-courts/schedule). Picking
// a day never touches the booked list; the two states are independent.
export type UpcomingBooking = {
  dateKey: string; // YYYY-MM-DD, in the same UTC-as-wall-clock convention every session time already uses
  startTime: string; // ISO
  timeLabel: string;
  title: string;
  athleteName: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - out.getUTCDay());
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Same offering, same day collapses into one group, same rule the main
// Explore list uses (groupByOfferingAndDay in page.tsx) — Dr. Dish's 30-min
// self-serve slots read as one block instead of a wall of near-identical cards.
function groupByOffering(cards: Card[]): Card[][] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const existing = groups.get(card.offeringId);
    if (existing) existing.push(card);
    else groups.set(card.offeringId, [card]);
  }
  return [...groups.values()];
}

export function BookingCalendar({ bookings, cards }: { bookings: UpcomingBooking[]; cards: Card[] }) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(todayUTC());
  const [selectedDay, setSelectedDay] = useState<string>(dateKey(todayUTC()));

  const cardsByDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      const key = c.startTime.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [cards]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, UpcomingBooking[]>();
    for (const b of bookings) {
      if (!map.has(b.dateKey)) map.set(b.dateKey, []);
      map.get(b.dateKey)!.push(b);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [bookings]);

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(cursor);

  const monthGrid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const weekGrid = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const today = todayUTC();
  const grid = mode === "month" ? monthGrid : weekGrid;
  const selectedGroups = useMemo(() => groupByOffering(cardsByDay.get(selectedDay) ?? []), [cardsByDay, selectedDay]);

  function step(dir: 1 | -1) {
    setCursor((c) =>
      mode === "month"
        ? new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + dir, 1))
        : addDays(c, dir * 7)
    );
  }

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-[340px] lg:shrink-0">
      <div className="rounded-lg border border-gray-mid bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-heading text-sm font-bold text-black">
            {mode === "month" ? monthLabel : `Week of ${weekGrid[0].getUTCDate()}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-mid text-gray-dark hover:border-orange hover:text-orange"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-mid text-gray-dark hover:border-orange hover:text-orange"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mb-2 flex gap-1">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1 font-sport text-[11px] font-bold uppercase tracking-wide ${
                mode === m ? "bg-black text-white" : "bg-gray-light text-gray-dark hover:text-black"
              }`}
            >
              {m === "month" ? "Month" : "Week"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="font-sport text-[9.5px] font-bold uppercase tracking-wide text-gray-dark">
              {w[0]}
            </span>
          ))}
          {grid.map((d) => {
            const key = dateKey(d);
            const hasAvailability = cardsByDay.has(key);
            const isToday = key === dateKey(today);
            const isSelected = key === selectedDay;
            const inMonth = mode === "week" || d.getUTCMonth() === cursor.getUTCMonth();
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                onMouseEnter={() => setSelectedDay(key)}
                className={`relative flex aspect-square items-center justify-center rounded-md font-body text-[12px] ${
                  isSelected
                    ? "bg-black text-white font-bold"
                    : isToday
                      ? "border border-orange text-orange font-bold"
                      : inMonth
                        ? "text-near-black hover:bg-gray-light"
                        : "text-gray-mid"
                }`}
              >
                {d.getUTCDate()}
                {hasAvailability && !isSelected ? (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-orange" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Availability for the selected day — click, or hover on desktop. */}
      <div className="rounded-lg border border-gray-mid bg-white p-3">
        <p className="mb-2 font-heading text-[13px] font-bold text-black">
          {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
            new Date(`${selectedDay}T00:00:00Z`)
          )}
        </p>
        {selectedGroups.length === 0 ? (
          <p className="font-body text-xs text-gray-dark">Nothing bookable this day.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {selectedGroups.map((group) => (
              <GroupedOfferingCard key={`${group[0].offeringId}-${group[0].sessionId}`} cards={group} />
            ))}
          </div>
        )}
      </div>

      {/* What you've booked — always visible, independent of the day picked
          above. Read-only by design; manage/cancel stays on Schedule. */}
      <div className="rounded-lg border border-gray-mid bg-white p-3">
        <p className="mb-2 font-heading text-[13px] font-bold text-black">What You&rsquo;ve Booked</p>
        {bookings.length === 0 ? (
          <p className="font-body text-xs text-gray-dark">Nothing booked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...bookingsByDay.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([day, dayBookings]) =>
                dayBookings.map((b, i) => (
                  <li key={`${day}-${i}`} className="rounded-md bg-gray-light px-2.5 py-2">
                    <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
                      {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
                        new Date(`${day}T00:00:00Z`)
                      )}{" "}
                      &middot; {b.timeLabel}
                    </p>
                    <p className="font-body text-[13px] font-medium text-near-black">{b.title}</p>
                    <p className="font-body text-[11.5px] text-gray-dark">{b.athleteName}</p>
                  </li>
                ))
              )}
          </ul>
        )}
        <Link
          href="/my-courts/schedule"
          className="mt-3 inline-block font-sport text-[11px] font-bold uppercase tracking-wide text-orange underline underline-offset-2"
        >
          Manage bookings →
        </Link>
      </div>
    </aside>
  );
}
