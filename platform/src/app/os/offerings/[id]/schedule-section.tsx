"use client";

import { useState, useTransition } from "react";
import {
  previewOfferingSchedule,
  generateOfferingSessions,
  moveOfferingSession,
  cancelOfferingSession,
  offerWaitlistSpot,
} from "../actions";
import { WEEKDAY_LABELS } from "@/lib/programs/recurrence";
import { Card, CardHeader, Field, INPUT, SELECT, TEXTAREA, BTN, Pill, ErrorNote, EmptyState } from "../../_components/ui";

// The scheduling half of the builder. Two rules shape it:
//
//   1. Nothing is created until the admin has seen exactly what will be
//      created. The preview and the writer run the same expansion, so the list
//      shown here IS the list that gets made.
//   2. Conflicts surface in the preview, before creation — not as a failure
//      halfway through creating eleven sessions.

type SessionRow = {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: string;
  title: string | null;
  dayIndex: number | null;
  isException: boolean;
  cancellationReason: string | null;
  resource: { id: string; name: string } | null;
  extraResources: { resource: { id: string; name: string } }[];
  coaches: { staff: { id: string; name: string }; role: string }[];
  _count: { bookings: number; waitlistEntries: number };
};

type ChangeRow = {
  id: string;
  changeType: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  familiesNotified: boolean | null;
  affectedRegistrations: number;
  createdAt: string;
  changedBy: { name: string } | null;
};

type Preview = {
  error: string | null;
  occurrences: { start: string; end: string; index: number }[];
  conflicts: { severity: string; type: string; message: string; at: string }[];
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(new Date(iso));

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(iso)
  );

export function ScheduleSection({
  offeringId,
  scheduleKind,
  defaultCapacity,
  defaultDuration,
  resources,
  coaches,
  sessions,
  changes,
  canEdit,
}: {
  offeringId: string;
  scheduleKind: string;
  defaultCapacity: number;
  defaultDuration: number;
  resources: { id: string; name: string; resourceType: string }[];
  coaches: { id: string; name: string; role: string; sports: string[] }[];
  sessions: SessionRow[];
  changes: ChangeRow[];
  canEdit: boolean;
}) {
  const [kind, setKind] = useState(scheduleKind === "season" ? "recurring" : scheduleKind);
  const [endMode, setEndMode] = useState<"date" | "count">("date");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const blocking = preview?.conflicts.filter((c) => c.severity === "blocking") ?? [];
  const warnings = preview?.conflicts.filter((c) => c.severity === "warning") ?? [];

  function runPreview(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      setCreateError(null);
      setPreview(await previewOfferingSchedule(offeringId, fd));
    });
  }

  function create(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const result = await generateOfferingSessions(offeringId, fd);
      if (result.ok) {
        setPreview(null);
        setCreateError(null);
      } else {
        setCreateError(result.error);
      }
    });
  }

  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const cancelled = sessions.filter((s) => s.status === "cancelled");

  return (
    <div className="flex flex-col gap-5">
      {canEdit ? (
        <Card>
          <CardHeader title="Add sessions" />
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              runPreview(e.currentTarget);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pattern" htmlFor="scheduleKind">
                <select
                  id="scheduleKind"
                  name="scheduleKind"
                  value={kind}
                  onChange={(e) => { setKind(e.target.value); setPreview(null); }}
                  className={SELECT}
                >
                  <option value="one_time">One time</option>
                  <option value="recurring">Recurring</option>
                  <option value="multi_day">Multi-day</option>
                  <option value="custom">Custom dates</option>
                </select>
              </Field>
              <Field label="Start time" htmlFor="startTime" required>
                <input id="startTime" name="startTime" type="time" defaultValue="17:00" className={INPUT} required />
              </Field>
              <Field label="Length (minutes)" htmlFor="durationMinutes" required>
                <input id="durationMinutes" name="durationMinutes" type="number" min="5" step="5" defaultValue={defaultDuration} className={INPUT} required />
              </Field>
            </div>

            {kind === "custom" ? (
              <Field label="Dates" htmlFor="customDates" hint="One YYYY-MM-DD per line. For irregular schedules — holiday clinics, league games.">
                <textarea id="customDates" name="customDates" rows={4} className={TEXTAREA} placeholder={"2026-10-30\n2026-11-14"} />
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={kind === "one_time" ? "Date" : "Starts"} htmlFor="startDate" required>
                  <input id="startDate" name="startDate" type="date" className={INPUT} required />
                </Field>
                {kind === "multi_day" ? (
                  <>
                    <Field label="Ends" htmlFor="endDate" required>
                      <input id="endDate" name="endDate" type="date" className={INPUT} required />
                    </Field>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 pb-3 text-sm">
                        <input type="checkbox" name="includeWeekends" />
                        Include weekends
                      </label>
                    </div>
                  </>
                ) : null}
                {kind === "recurring" ? (
                  <>
                    <Field label="Ends" htmlFor="endMode">
                      <select
                        id="endMode"
                        name="endMode"
                        value={endMode}
                        onChange={(e) => setEndMode(e.target.value as "date" | "count")}
                        className={SELECT}
                      >
                        <option value="date">On a date</option>
                        <option value="count">After N sessions</option>
                      </select>
                    </Field>
                    {endMode === "date" ? (
                      <Field label="End date" htmlFor="endDate" required>
                        <input id="endDate" name="endDate" type="date" className={INPUT} required />
                      </Field>
                    ) : (
                      <Field label="Number of sessions" htmlFor="occurrenceCount" required>
                        <input id="occurrenceCount" name="occurrenceCount" type="number" min="1" max="400" defaultValue={10} className={INPUT} required />
                      </Field>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {kind === "recurring" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repeats" htmlFor="frequency">
                  <select id="frequency" name="frequency" className={SELECT}>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every other week</option>
                  </select>
                </Field>
                <fieldset>
                  <legend className="os-eyebrow mb-1.5 text-gray-dark">Days</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((label, i) => (
                      <label
                        key={label}
                        className="cursor-pointer rounded-lg border border-gray-mid bg-white px-3 py-2 text-sm has-checked:border-orange has-checked:bg-orange has-checked:text-white"
                      >
                        <input type="checkbox" name="weekdays" value={i} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Capacity per session" htmlFor="capacity" required>
                <input id="capacity" name="capacity" type="number" min="1" defaultValue={defaultCapacity} className={INPUT} required />
              </Field>
              <fieldset className="sm:col-span-2">
                <legend className="os-eyebrow mb-1.5 text-gray-dark">Courts / resources</legend>
                <div className="flex flex-wrap gap-1.5">
                  {resources.map((r) => (
                    <label key={r.id} className="cursor-pointer rounded-lg border border-gray-mid bg-white px-3 py-2 text-sm has-checked:border-orange has-checked:bg-orange has-checked:text-white">
                      <input type="checkbox" name="resourceIds" value={r.id} className="sr-only" />
                      {r.name}
                    </label>
                  ))}
                  {resources.length === 0 ? <p className="text-sm text-neutral">No resources configured.</p> : null}
                </div>
              </fieldset>
            </div>

            <fieldset>
              <legend className="os-eyebrow mb-1.5 text-gray-dark">Coaches / staff</legend>
              <div className="flex flex-wrap gap-1.5">
                {coaches.map((c) => (
                  <label key={c.id} className="cursor-pointer rounded-lg border border-gray-mid bg-white px-3 py-2 text-sm has-checked:border-orange has-checked:bg-orange has-checked:text-white">
                    <input type="checkbox" name="coachIds" value={c.id} className="sr-only" />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-neutral">
                First one selected is the lead. You can leave this empty on a draft and assign later.
              </p>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pending} className={BTN.secondary}>
                {pending ? "Checking…" : "Preview Sessions"}
              </button>
              {preview && preview.occurrences.length > 0 && blocking.length === 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={(e) => create(e.currentTarget.form!)}
                  className={BTN.primary}
                >
                  Create {preview.occurrences.length} Session{preview.occurrences.length === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>

            {preview?.error ? <ErrorNote>{preview.error}</ErrorNote> : null}
            {createError ? <ErrorNote>{createError}</ErrorNote> : null}

            {preview && preview.occurrences.length > 0 ? (
              <div className="rounded-xl border border-gray-mid bg-warm-white p-4">
                <p className="os-eyebrow mb-2 text-near-black">
                  You&apos;re about to create {preview.occurrences.length} session
                  {preview.occurrences.length === 1 ? "" : "s"}
                </p>

                {blocking.length > 0 ? (
                  <div role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger-bg p-3">
                    <p className="os-eyebrow mb-1.5 text-danger">Blocked — fix these first</p>
                    <ul className="flex flex-col gap-1 text-sm text-danger">
                      {blocking.map((c, i) => <li key={i}>· {c.message}</li>)}
                    </ul>
                  </div>
                ) : null}

                {warnings.length > 0 ? (
                  <div className="mb-3 rounded-lg border border-warning/30 bg-warning-bg p-3">
                    <p className="os-eyebrow mb-1.5 text-warning">Warnings — you can proceed</p>
                    <ul className="flex flex-col gap-1 text-sm text-warning">
                      {warnings.map((c, i) => <li key={i}>· {c.message}</li>)}
                    </ul>
                  </div>
                ) : null}

                <ul className="os-num grid gap-x-6 gap-y-1 text-sm text-gray-dark sm:grid-cols-2 lg:grid-cols-3">
                  {preview.occurrences.map((o) => (
                    <li key={o.index}>
                      {fmtDateTime(o.start)}–{fmtTime(o.end)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Scheduled sessions" count={scheduled.length} />
        {scheduled.length === 0 ? (
          <EmptyState headline="Nothing on the calendar." detail="Add sessions above and they'll appear here." />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {scheduled.map((s) => (
              <SessionRowView key={s.id} session={s} canEdit={canEdit} resources={resources} />
            ))}
          </ul>
        )}
      </Card>

      {cancelled.length > 0 ? (
        <Card>
          <CardHeader title="Cancelled" count={cancelled.length} />
          <ul className="divide-y divide-gray-mid">
            {cancelled.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm text-gray-dark line-through">{fmtDateTime(s.startTime)}</p>
                  {s.cancellationReason ? (
                    <p className="text-xs text-neutral">{s.cancellationReason}</p>
                  ) : null}
                </div>
                <Pill tone="danger">Cancelled</Pill>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Change history" />
        {changes.length === 0 ? (
          <EmptyState headline="No changes yet." detail="Every move and cancellation is recorded here — who did it, when, and whether families were told." />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {changes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-near-black">
                    <span className="os-eyebrow mr-2 text-orange">{c.changeType.replace(/_/g, " ")}</span>
                    {c.previousValue && c.newValue ? `${c.previousValue} → ${c.newValue}` : (c.newValue ?? "")}
                  </p>
                  <p className="text-xs text-neutral">
                    {fmtDateTime(c.createdAt)}
                    {c.changedBy ? ` · ${c.changedBy.name}` : ""}
                  </p>
                </div>
                <p className="mt-1 text-xs text-neutral">
                  {c.reason ? `${c.reason} · ` : ""}
                  {c.affectedRegistrations} registration{c.affectedRegistrations === 1 ? "" : "s"} affected
                  {c.familiesNotified === null
                    ? ""
                    : c.familiesNotified
                      ? " · families notified"
                      : " · families not notified"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SessionRowView({
  session,
  canEdit,
  resources,
}: {
  session: SessionRow;
  canEdit: boolean;
  resources: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState<"none" | "move" | "cancel">("none");
  const [error, setError] = useState<string | null>(null);
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const courts = [session.resource?.name, ...session.extraResources.map((r) => r.resource.name)]
    .filter(Boolean)
    .join(" + ");
  const durationMinutes = Math.round(
    (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000
  );

  function submit(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const r = await action(fd);
      if (r.ok) { setOpen("none"); setError(null); }
      else setError(r.error ?? "That didn't work.");
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="os-num text-sm text-near-black">
            {fmtDateTime(session.startTime)}–{fmtTime(session.endTime)}
            {session.dayIndex ? <span className="ml-2 text-neutral">Day {session.dayIndex}</span> : null}
            {session.isException ? <span className="os-eyebrow ml-2 text-warning">Edited</span> : null}
          </p>
          <p className="text-xs text-neutral">
            {[courts || "No court", session.coaches.map((c) => c.staff.name).join(", ") || "No coach"].join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="os-num text-sm text-gray-dark">
            {session._count.bookings}/{session.capacity}
          </span>
          {session._count.waitlistEntries > 0 ? (
            <>
              <Pill tone="info">{session._count.waitlistEntries} waiting</Pill>
              {canEdit && session._count.bookings < session.capacity ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await offerWaitlistSpot(session.id);
                      setWaitlistMsg(r.message);
                    })
                  }
                  className="os-eyebrow min-h-9 px-2 text-orange underline underline-offset-2"
                >
                  Offer spot
                </button>
              ) : null}
            </>
          ) : null}
          {session.coaches.length === 0 ? <Pill tone="danger">Needs coach</Pill> : null}
          {canEdit ? (
            <>
              <button type="button" onClick={() => setOpen(open === "move" ? "none" : "move")} className="os-eyebrow min-h-9 px-2 text-gray-dark underline underline-offset-2 hover:text-orange">
                Move
              </button>
              <button type="button" onClick={() => setOpen(open === "cancel" ? "none" : "cancel")} className="os-eyebrow min-h-9 px-2 text-danger underline underline-offset-2">
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>

      {waitlistMsg ? (
        <p role="status" className="mt-2 rounded-lg border border-info/30 bg-info-bg px-3 py-2 text-sm text-info">
          {waitlistMsg}
        </p>
      ) : null}

      {open === "move" ? (
        <form
          className="mt-3 rounded-lg border border-gray-mid bg-warm-white p-3"
          onSubmit={(e) => { e.preventDefault(); submit(moveOfferingSession, e.currentTarget); }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="durationMinutes" value={durationMinutes} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New date and time" htmlFor={`ns-${session.id}`} required>
              <input id={`ns-${session.id}`} name="newStart" type="datetime-local" defaultValue={session.startTime.slice(0, 16)} className={INPUT} required />
            </Field>
            <Field label="Apply to" htmlFor={`sc-${session.id}`}>
              <select id={`sc-${session.id}`} name="scope" className={SELECT}>
                <option value="this">This session only</option>
                <option value="this_and_future">This and future sessions</option>
                <option value="series">The entire series</option>
              </select>
            </Field>
            <Field label="Reason" htmlFor={`rs-${session.id}`} hint="Recorded in the change history.">
              <input id={`rs-${session.id}`} name="reason" className={INPUT} />
            </Field>
          </div>
          {session._count.bookings > 0 ? (
            <div className="mt-3 rounded-lg border border-warning/30 bg-warning-bg p-3 text-sm text-warning">
              {session._count.bookings} registration{session._count.bookings === 1 ? " is" : "s are"} attached to this session.
              <div className="mt-2 flex flex-col gap-1.5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="notifyFamilies" defaultChecked /> Notify families
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="notifyCoach" defaultChecked /> Notify coach
                </label>
              </div>
            </div>
          ) : null}
          {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={pending} className={BTN.primary}>
              {pending ? "Moving…" : "Move + Review"}
            </button>
            <button type="button" onClick={() => setOpen("none")} className={BTN.ghost}>Cancel</button>
          </div>
        </form>
      ) : null}

      {open === "cancel" ? (
        <form
          className="mt-3 rounded-lg border border-danger/30 bg-danger-bg p-3"
          onSubmit={(e) => { e.preventDefault(); submit(cancelOfferingSession, e.currentTarget); }}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason" htmlFor={`cr-${session.id}`} hint="Required. Families and coaches see the schedule change." required>
              <input id={`cr-${session.id}`} name="reason" className={INPUT} required />
            </Field>
            <Field label="Apply to" htmlFor={`cs-${session.id}`}>
              <select id={`cs-${session.id}`} name="scope" className={SELECT}>
                <option value="this">This session only</option>
                <option value="this_and_future">This and future sessions</option>
                <option value="series">The entire series</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-sm text-danger">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="restoreCredits" defaultChecked /> Restore Training Plan session credits
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notifyFamilies" defaultChecked /> Notify families
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notifyCoach" defaultChecked /> Notify coach
            </label>
            <p className="mt-1 text-xs">
              Refunds are not decided here. Cancelling releases the seats and records the change;
              any refund is handled deliberately from the registration.
            </p>
          </div>
          {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={pending} className={BTN.danger}>
              {pending ? "Cancelling…" : `Cancel ${session._count.bookings > 0 ? `(${session._count.bookings} registered)` : "session"}`}
            </button>
            <button type="button" onClick={() => setOpen("none")} className={BTN.ghost}>Keep it</button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
