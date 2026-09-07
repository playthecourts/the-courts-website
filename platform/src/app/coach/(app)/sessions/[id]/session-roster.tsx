"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { markAttendance, markAllHere } from "../actions";
import type { AttendanceStatus } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// The roster + one-tap attendance.
//
// Two requirements shape this component:
//
//  1. Speed. Eight athletes in ten seconds means no navigation, no dialogs,
//     no per-athlete screens. Four buttons per row, plus "Mark All Here" for
//     the common case where everyone showed up.
//
//  2. Never silently lose attendance. State is applied optimistically so the
//     tap feels instant, but a failed write is NOT rolled back silently — the
//     row is marked "Not synced", kept in a pending queue, and retried when
//     the browser comes back online. A coach can always see what hasn't saved.
// ---------------------------------------------------------------------------

export type RosterRow = {
  bookingId: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  initials: string;
  attendance: AttendanceStatus | null;
  rsvp: string | null;
  flags: string[];
  registrationLabel: string;
  registrationTone: "ok" | "warn" | "neutral";
  planLabel: string | null;
  /// Two words only: Media OK / Ask First / No Media / Not Answered. Shown so a
  /// coach doesn't photograph a child whose family said not to — never the
  /// release text, the guardian's identity or the consent history.
  mediaLabel: string;
  mediaNeedsCare: boolean;
};

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Here" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

const FLAG_LABELS: Record<string, string> = {
  new_athlete: "NEW",
  first_session: "FIRST SESSION",
  needs_evaluation: "NEEDS EVAL",
  parent_follow_up: "FOLLOW UP",
  attendance_concern: "ATTENDANCE",
};

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-emerald-600 text-white border-emerald-600",
  late: "bg-amber-500 text-white border-amber-500",
  absent: "bg-red-600 text-white border-red-600",
  excused: "bg-charcoal text-white border-charcoal",
};

export default function SessionRoster({
  sessionId,
  rows,
  showRsvp,
}: {
  sessionId: string;
  rows: RosterRow[];
  showRsvp: boolean;
}) {
  const [local, setLocal] = useState<Record<string, AttendanceStatus>>({});
  const [unsynced, setUnsynced] = useState<Record<string, AttendanceStatus>>({});
  const [pending, startTransition] = useTransition();
  const unsyncedRef = useRef(unsynced);
  unsyncedRef.current = unsynced;

  const send = useCallback(
    async (bookingId: string, status: AttendanceStatus) => {
      try {
        const res = await markAttendance(sessionId, bookingId, status);
        if (res?.ok) {
          setUnsynced((u) => {
            const next = { ...u };
            delete next[bookingId];
            return next;
          });
          return true;
        }
      } catch {
        // Network failure courtside — fall through to the unsynced queue.
      }
      setUnsynced((u) => ({ ...u, [bookingId]: status }));
      return false;
    },
    [sessionId]
  );

  // Retry anything still unsynced as soon as connectivity returns.
  useEffect(() => {
    const retry = () => {
      const queue = Object.entries(unsyncedRef.current);
      for (const [bookingId, status] of queue) void send(bookingId, status);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [send]);

  const set = (bookingId: string, status: AttendanceStatus) => {
    setLocal((s) => ({ ...s, [bookingId]: status }));
    void send(bookingId, status);
  };

  const allHere = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const r of rows) next[r.bookingId] = "present";
    setLocal(next);
    startTransition(async () => {
      try {
        await markAllHere(sessionId);
        setUnsynced({});
      } catch {
        setUnsynced(next);
      }
    });
  };

  const statusOf = (r: RosterRow) => local[r.bookingId] ?? r.attendance;
  const markedCount = rows.filter((r) => statusOf(r) !== null && statusOf(r) !== undefined).length;
  const unsyncedCount = Object.keys(unsynced).length;
  const allMarked = rows.length > 0 && markedCount === rows.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Roster · {markedCount}/{rows.length} marked
        </h2>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={allHere}
            disabled={pending}
            className="min-h-[36px] rounded-full border border-near-black bg-white px-3 font-sport text-[11px] font-bold uppercase tracking-wide text-near-black hover:bg-near-black hover:text-white disabled:opacity-50"
          >
            Mark All Here
          </button>
        )}
      </div>

      {unsyncedCount > 0 && (
        <p
          role="alert"
          className="mb-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 font-body text-sm text-amber-950"
        >
          {unsyncedCount} change{unsyncedCount === 1 ? "" : "s"} haven&apos;t saved yet. They&apos;ll
          retry automatically — keep this screen open until the warning clears.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center font-body text-sm text-gray-dark">
            Nobody registered yet.
          </p>
        ) : (
          rows.map((r) => {
            const status = statusOf(r);
            const isUnsynced = Boolean(unsynced[r.bookingId]);
            return (
              <div key={r.bookingId} className="border-b border-gray-mid px-3 py-2.5 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm-stone font-sport text-xs font-bold text-charcoal"
                  >
                    {r.initials}
                  </span>

                  <Link
                    href={`/coach/athletes/${r.athleteId}`}
                    className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange"
                  >
                    <span className="block truncate font-heading text-[15px] font-bold text-near-black">
                      {r.firstName} {r.lastName}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-body text-xs text-gray-dark">
                      {r.grade && <span>{r.grade}</span>}
                      {r.registrationTone === "warn" && (
                        <span className="font-sport font-bold uppercase text-red-700">
                          {r.registrationLabel}
                        </span>
                      )}
                      {r.planLabel && <span>· {r.planLabel}</span>}
                      {/* Only surfaced when it changes what a coach should do.
                          "Media OK" is the quiet default and needs no shouting. */}
                      {r.mediaNeedsCare && (
                        <span className="font-sport font-bold uppercase text-amber-700">
                          · {r.mediaLabel}
                        </span>
                      )}
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1">
                    {r.flags.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-orange px-1.5 py-0.5 font-sport text-[9.5px] font-bold uppercase tracking-wide text-white"
                      >
                        {FLAG_LABELS[f] ?? f}
                      </span>
                    ))}
                    {showRsvp && r.rsvp && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-sport text-[9.5px] font-bold uppercase tracking-wide ${
                          r.rsvp === "going"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.rsvp === "not_going"
                              ? "bg-red-100 text-red-800"
                              : "bg-warm-stone text-gray-dark"
                        }`}
                      >
                        {r.rsvp === "going" ? "Going" : r.rsvp === "not_going" ? "Can't Make It" : "Not Sure"}
                      </span>
                    )}
                    {isUnsynced && (
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 font-sport text-[9.5px] font-bold uppercase text-amber-950">
                        Not Synced
                      </span>
                    )}
                  </div>
                </div>

                {/* 4-up attendance. Buttons are 44px tall and full-width in
                    their quarter, so they're reliably hittable one-handed. */}
                <div
                  role="group"
                  aria-label={`Attendance for ${r.firstName} ${r.lastName}`}
                  className="mt-2 grid grid-cols-4 gap-1.5"
                >
                  {OPTIONS.map((opt) => {
                    const selected = status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => set(r.bookingId, opt.value)}
                        className={`min-h-[44px] rounded-lg border font-sport text-[12px] font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange ${
                          selected
                            ? STATUS_STYLES[opt.value]
                            : "border-gray-mid bg-white text-gray-dark hover:border-near-black hover:text-near-black"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {allMarked && unsyncedCount === 0 && (
        <p className="mt-3 text-center font-display text-sm font-black uppercase tracking-tight text-emerald-700">
          All checked in. Go coach.
        </p>
      )}
    </div>
  );
}
