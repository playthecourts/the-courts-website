"use client";

import { facilityTodayKey } from "@/lib/facility-time";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSessionRoster, type RosterRow } from "./actions";
import { rosterSetCheckIn } from "../rosters/actions";
import { AddAthleteForm } from "../rosters/add-athlete-form";
import type { ScheduleCard, ClosureBand } from "@/lib/programs/schedule-view";

// A real time grid: days across, time down, cards positioned by their actual
// start and duration. Density is the point — this is an admin tool, so a card
// carries time, program, coach, court and fill in the space a marketing tile
// would spend on a photograph.

const DAY_START_MIN = 9 * 60;   // 9 AM
const DAY_END_MIN = 22 * 60;    // 10 PM
const PX_PER_MIN = 1.1;         // ~66px per hour: a 60-min session is legible.
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;
const OPENING_DAY = "2026-10-01";

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
  const [roster, setRoster] = useState<RosterState | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback((sessionId: string) => {
    return getSessionRoster(sessionId).then((res) => {
      setRoster(
        res.ok
          ? { id: sessionId, rows: res.rows, canEdit: res.canEdit, addable: res.addable }
          : { id: sessionId, rows: null, canEdit: false, addable: [], error: res.error }
      );
    });
  }, []);

  // Load who's in the class when a card is opened (even an empty one, so
  // staff can add the first kid from here).
  useEffect(() => {
    if (!selected) return;
    let live = true;
    getSessionRoster(selected.id).then((res) => {
      if (!live) return;
      setRoster(
        res.ok
          ? { id: selected.id, rows: res.rows, canEdit: res.canEdit, addable: res.addable }
          : { id: selected.id, rows: null, canEdit: false, addable: [], error: res.error }
      );
    });
    return () => {
      live = false;
    };
  }, [selected]);
  const rows = selected && roster?.id === selected.id ? roster : null;

  function openCard(card: ScheduleCard) {
    setSearch("");
    setRowError(null);
    setSelected(card);
  }

  // Same check-in record as Class Rosters, the Front Desk and the kiosk.
  // Flip the row right away, then confirm with the server.
  async function toggleHere(r: RosterRow) {
    if (!rows?.rows || !selected) return;
    const next = !r.here;
    setBusy(r.bookingId);
    setRowError(null);
    setRoster({ ...rows, rows: rows.rows.map((x) => (x.bookingId === r.bookingId ? { ...x, here: next } : x)) });
    const res = await rosterSetCheckIn(r.bookingId, next);
    if (!res.ok) {
      setRowError(`${r.name}: ${res.error}`);
      await load(selected.id);
    }
    setBusy(null);
  }
  const start = new Date(weekStartIso);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const todayKey = facilityTodayKey();
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
              const isOpeningDay = key === OPENING_DAY;
              const isBeforeOpening = key < OPENING_DAY;
              return (
                <div
                  key={key}
                  className={`border-l border-gray-mid px-2 py-2 text-center ${
                    isBeforeOpening ? "bg-gray-light/70" : isToday ? "bg-orange/5" : ""
                  }`}
                >
                  <p className={`os-eyebrow ${isBeforeOpening ? "text-gray-mid" : isToday ? "text-orange" : "text-neutral"}`}>
                    {new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d)}
                  </p>
                  <p className={`os-num text-sm ${isBeforeOpening ? "text-gray-mid" : isToday ? "text-orange" : "text-near-black"}`}>
                    {d.getUTCDate()}
                  </p>
                  {isOpeningDay && (
                    <p className="os-eyebrow mt-0.5 rounded-full bg-orange px-1.5 py-0.5 text-[9px] leading-none text-white">
                      Opening Day
                    </p>
                  )}
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
              // Cancelled sessions used to still render, dimmed and struck
              // through — Melissa wants the week grid to only show what's
              // actually happening, not a record of what got cancelled.
              const dayCards = cards.filter((c) => c.dayKey === key && c.status !== "cancelled");
              const dayClosures = closures.filter(
                (b) => new Date(b.start) < new Date(`${key}T23:59:59Z`) && new Date(b.end) > new Date(`${key}T00:00:00Z`)
              );

              // Side-by-side layout for cards that overlap in time.
              const laid = layout(dayCards);
              const isBeforeOpening = key < OPENING_DAY;

              return (
                <div
                  key={key}
                  className={`relative border-l border-gray-mid ${
                    isBeforeOpening ? "bg-gray-light/70" : key === todayKey ? "bg-orange/[0.03]" : ""
                  }`}
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
                    // A block's note is the actual reason someone set it
                    // aside ("Fall League Practice — 3rd/4th Grade") — show
                    // that instead of a generic "Facility closed" label that
                    // reads identically for every block, whatever it's for.
                    const label = b.note?.trim() || `${b.resourceName ?? "Facility"} closed`;
                    // "Closed" reasons (holiday, cleaning — nothing
                    // happening, facility's just shut) get the
                    // diagonal-stripe pattern back; reasons where something
                    // real IS using the time (a practice, a party) stay flat
                    // gray, since that's not the same kind of "closed."
                    const isHoliday = b.reason === "holiday" || b.reason === "maintenance";
                    return (
                      <div
                        key={b.id}
                        title={`${label} — ${b.reason.replace(/_/g, " ")}`}
                        className={`absolute inset-x-0.5 overflow-hidden rounded border border-gray-mid ${
                          isHoliday
                            ? "bg-[repeating-linear-gradient(45deg,var(--color-gray-light),var(--color-gray-light)_5px,var(--color-gray-mid)_5px,var(--color-gray-mid)_10px)]"
                            : "bg-gray-mid/40"
                        }`}
                        style={{ top: (s - DAY_START_MIN) * PX_PER_MIN, height: (e - s) * PX_PER_MIN }}
                      >
                        <span
                          className={`os-heading block px-1 py-0.5 text-[11px] leading-tight font-bold text-near-black ${
                            isHoliday ? "bg-white/85" : ""
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}

                  {laid.map(({ card, col, cols }) => {
                    // A handful of real camp sessions start at 8 AM, before
                    // this grid's new 9 AM top edge — clamp rather than let
                    // them render with a negative offset above the grid.
                    const clampedStart = Math.max(card.startMinute, DAY_START_MIN);
                    const top = (clampedStart - DAY_START_MIN) * PX_PER_MIN;
                    const height = Math.max(26, (card.startMinute + card.durationMinutes - clampedStart) * PX_PER_MIN - 2);
                    const cancelled = card.status === "cancelled";
                    const isDraft = card.offeringStatus && card.offeringStatus !== "published";
                    const full = card.booked >= card.capacity;

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => openCard(card)}
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
                        <p className="os-num text-[11.5px] leading-tight text-neutral">
                          {fmtTime(card.start)}–{fmtTime(card.end)}
                        </p>
                        <p className="os-heading truncate text-[12px] leading-tight text-near-black">
                          {card.title ?? card.offeringName}
                        </p>
                        {height > 44 ? (
                          <p className="truncate text-[11.5px] leading-tight text-gray-dark">
                            {[card.coachNames[0], card.resourceNames[0]].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        {height > 58 ? (
                          <p className={`os-num text-[11.5px] leading-tight ${full ? "text-danger" : "text-neutral"}`}>
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
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-mid bg-white p-5" onClick={(e) => e.stopPropagation()}>
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
            <div className="mt-4">
              {(() => {
                const isToday = selected.dayKey === todayKey && selected.status !== "cancelled";
                const canCheckIn = isToday && !!rows?.canEdit;
                const list = rows?.rows ?? [];
                const hereCount = list.filter((r) => r.here).length;
                const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
                const shown = words.length
                  ? list.filter((r) => words.every((w) => r.name.toLowerCase().includes(w)))
                  : list;
                return (
                  <>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="os-eyebrow text-neutral">Who&rsquo;s Signed Up</p>
                      {list.length > 0 && isToday ? (
                        <p className="os-num text-xs text-gray-dark">{hereCount} of {list.length} here</p>
                      ) : null}
                    </div>
                    {!rows ? (
                      <p className="text-sm text-gray-dark">Loading…</p>
                    ) : rows.error ? (
                      <p className="text-sm text-danger">{rows.error}</p>
                    ) : list.length === 0 ? (
                      <p className="text-sm text-gray-dark">No one yet.</p>
                    ) : (
                      <>
                        {list.length > 4 ? (
                          <input
                            type="search"
                            inputMode="search"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Find an athlete in this class…"
                            aria-label="Find an athlete in this class"
                            className="mb-2 min-h-11 w-full rounded-lg border border-gray-mid bg-white px-3 text-sm text-near-black placeholder:text-neutral/60 focus:border-orange focus:outline-none"
                          />
                        ) : null}
                        <ul className="max-h-[45vh] overflow-y-auto rounded-lg border border-gray-mid">
                          {shown.length === 0 ? (
                            <li className="px-3 py-2.5 text-sm text-gray-dark">No one in this class matches &ldquo;{search}&rdquo;.</li>
                          ) : (
                            shown.map((r) => (
                              <li key={r.athleteId} className="flex min-h-12 items-center justify-between gap-3 border-b border-gray-mid/60 px-3 py-1.5 text-sm last:border-b-0">
                                <Link href={`/os/athletes/${r.athleteId}`} className="truncate text-near-black hover:underline">
                                  {r.name}
                                  {r.grade ? <span className="text-gray-dark"> · {r.grade}</span> : null}
                                </Link>
                                <span className="flex shrink-0 items-center gap-2 text-xs">
                                  {r.due ? <span className="text-warning">Due</span> : null}
                                  {canCheckIn ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleHere(r)}
                                      disabled={busy === r.bookingId}
                                      aria-pressed={r.here}
                                      className={`os-heading inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs uppercase tracking-wide transition-colors disabled:opacity-60 ${
                                        r.here ? "border-success bg-success-bg text-success" : "border-gray-mid bg-white text-near-black hover:border-near-black"
                                      }`}
                                    >
                                      <span aria-hidden="true">{r.here ? "✓" : "○"}</span>
                                      {r.here ? "Checked In" : "Check In"}
                                    </button>
                                  ) : r.here ? (
                                    <span className="text-success">✓ Here</span>
                                  ) : null}
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                    {rowError ? <p className="mt-1.5 text-xs text-danger">{rowError}</p> : null}
                    {rows?.canEdit && selected.status !== "cancelled" ? (
                      <div className="mt-3">
                        <AddAthleteForm
                          bare
                          sessionId={selected.id}
                          athletes={rows.addable}
                          onAdded={() => load(selected.id)}
                        />
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/os/rosters?date=${selected.start.slice(0, 10)}`}
                className="os-heading inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-mid px-4 text-sm uppercase tracking-wide text-near-black"
              >
                Class Roster
              </Link>
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

type RosterState = {
  id: string;
  rows: RosterRow[] | null;
  canEdit: boolean;
  addable: { id: string; label: string }[];
  error?: string;
};

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
