"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deskCheckIn, deskUndoCheckIn, deskAddWalkIn } from "./actions";

// The desk's check-in board: every class today, every athlete in it, one tap
// to check in. Built for an iPad held at the door — big rows, no dialogs, and
// it quietly refreshes so a kid who checked in at the lobby kiosk turns green
// here too.

export type DeskAthlete = {
  bookingId: string;
  athleteId: string;
  fullName: string;
  grade: string | null;
  here: boolean;
  late: boolean;
  absent: boolean;
  selfCheckedIn: boolean;
  paymentDue: boolean;
  /// Safety flags — that a concern exists; detail is on the athlete page.
  health: boolean;
  pickupRestriction: boolean;
};
export type DeskClass = {
  id: string;
  name: string;
  time: string;
  coach: string;
  capacity: number;
  athletes: DeskAthlete[];
};
export type WalkInOption = { id: string; label: string };

export function CheckinBoard({ classes, walkInOptions, canAddWalkIns }: { classes: DeskClass[]; walkInOptions: WalkInOption[]; canAddWalkIns: boolean }) {
  const router = useRouter();

  // Pick up kiosk and coach check-ins without anyone pulling to refresh.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);

  if (classes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-mid bg-white px-4 py-6 text-center font-body text-[14px] text-gray-dark">
        No classes on the schedule today.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {classes.map((c) => (
        <ClassCard key={c.id} c={c} walkInOptions={walkInOptions} canAddWalkIns={canAddWalkIns} />
      ))}
    </div>
  );
}

function ClassCard({ c, walkInOptions, canAddWalkIns }: { c: DeskClass; walkInOptions: WalkInOption[]; canAddWalkIns: boolean }) {
  const hereCount = c.athletes.filter((a) => a.here).length;
  return (
    <section className="overflow-hidden rounded-xl border border-gray-mid bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-mid px-4 py-3">
        <div className="min-w-0">
          <p className="font-sport text-xs font-bold uppercase tracking-[0.12em] text-orange">{c.time}</p>
          <h2 className="font-heading text-[17px] font-bold text-near-black">{c.name}</h2>
          {c.coach ? <p className="font-body text-[13px] text-gray-dark">Coach {c.coach}</p> : null}
        </div>
        <p className="shrink-0 text-right font-body text-[13px] text-gray-dark">
          <span className="block font-display text-[22px] font-black text-near-black">
            {hereCount}<span className="text-[15px] text-gray-dark">/{c.athletes.length}</span>
          </span>
          checked in
        </p>
      </header>
      {c.athletes.length === 0 ? (
        <p className="px-4 py-3 font-body text-[14px] text-gray-dark">Nobody signed up yet.</p>
      ) : (
        <ul className="divide-y divide-gray-mid">
          {c.athletes.map((a) => <AthleteRow key={a.bookingId} a={a} />)}
        </ul>
      )}
      {canAddWalkIns ? (
        <WalkIn
          sessionId={c.id}
          options={walkInOptions.filter((o) => !c.athletes.some((a) => a.athleteId === o.id))}
          full={c.athletes.length >= c.capacity}
        />
      ) : null}
    </section>
  );
}

function AthleteRow({ a }: { a: DeskAthlete }) {
  const router = useRouter();
  // Optimistic override while a tap is saving; otherwise the server's value,
  // which the 20s refresh keeps current (kiosk and coach check-ins included).
  const [override, setOverride] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const here = override ?? a.here;

  function toggle() {
    const next = !here;
    setOverride(next);
    setError(null);
    start(async () => {
      const res = next ? await deskCheckIn(a.bookingId) : await deskUndoCheckIn(a.bookingId);
      if (!res.ok) setError(res.error);
      router.refresh();
      setOverride(null);
    });
  }

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={here}
        className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${here ? "bg-emerald-50" : "hover:bg-gray-light"}`}
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[18px] font-bold ${
            here ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-mid text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-heading text-[16px] font-bold text-near-black">{a.fullName}</span>
            {a.health ? (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 font-sport text-[11px] font-bold uppercase tracking-wide text-warning">Health</span>
            ) : null}
            {a.pickupRestriction ? (
              <span className="rounded-full bg-danger-bg px-2 py-0.5 font-sport text-[11px] font-bold uppercase tracking-wide text-danger">Pickup</span>
            ) : null}
          </span>
          <span className="block font-body text-[13px] text-gray-dark">
            {[
              a.grade ? `${a.grade} Grade` : null,
              here ? (a.selfCheckedIn ? "Checked in at kiosk" : "Checked in") + (a.late ? " · Late" : "") : a.absent ? "Marked absent by coach" : "Tap to check in",
            ].filter(Boolean).join(" · ")}
          </span>
          {error ? <span className="mt-1 block font-body text-[13px] text-danger">{error}</span> : null}
        </span>
        {a.paymentDue ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 font-sport text-[11px] font-bold uppercase tracking-wide text-amber-800">Payment due</span>
        ) : null}
      </button>
    </li>
  );
}

function WalkIn({ sessionId, options, full }: { sessionId: string; options: WalkInOption[]; full: boolean }) {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!athleteId) return;
    setMsg(null);
    start(async () => {
      const res = await deskAddWalkIn(sessionId, athleteId);
      setMsg(res.ok ? { ok: true, text: res.message ?? "Added" } : { ok: false, text: res.error });
      if (res.ok) setAthleteId("");
      router.refresh();
    });
  }

  return (
    <div className="border-t border-gray-mid bg-gray-light/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`walkin-${sessionId}`} className="sr-only">Walk-in athlete</label>
        <select
          id={`walkin-${sessionId}`}
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          disabled={full}
          className="min-h-[48px] min-w-0 flex-1 rounded-lg border border-gray-mid bg-white px-3 font-body text-[16px] text-near-black"
        >
          <option value="">{full ? "Class is full" : "Add a walk-in…"}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!athleteId || pending || full}
          className="min-h-[48px] rounded-lg bg-orange px-4 font-sport text-[13px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add + Check In"}
        </button>
      </div>
      {msg ? <p className={`mt-2 font-body text-[13px] ${msg.ok ? "text-emerald-700" : "text-danger"}`}>{msg.text}</p> : null}
    </div>
  );
}
