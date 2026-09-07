"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createFacilityBlock } from "./actions";
import { Field, INPUT, SELECT, BTN, ErrorNote } from "../_components/ui";

// Blocking time can strand sessions families have already booked. The form
// reports exactly which ones rather than cancelling them — mass cancellation
// and mass notification are decisions a person makes, not a side effect.

type Affected = { id: string; offeringId: string | null; name: string; start: string; registrations: number };

export function BlockForm({ resources }: { resources: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createFacilityBlock, null as
    | { error?: string; ok?: true; affected?: Affected[] }
    | null);

  return (
    <>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <Field label="What's closed" htmlFor="resourceId" hint="Leave blank to close the whole facility.">
          <select id="resourceId" name="resourceId" className={SELECT} defaultValue="">
            <option value="">Whole facility</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Reason" htmlFor="reason">
          <select id="reason" name="reason" className={SELECT} defaultValue="maintenance">
            <option value="holiday">Holiday</option>
            <option value="maintenance">Maintenance</option>
            <option value="repair">Repair</option>
            <option value="private_event">Private event</option>
            <option value="owner_block">Owner block</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="From" htmlFor="startTime" required>
          <input id="startTime" name="startTime" type="datetime-local" className={INPUT} required />
        </Field>
        <Field label="Until" htmlFor="endTime" required>
          <input id="endTime" name="endTime" type="datetime-local" className={INPUT} required />
        </Field>
        <Field label="Note" htmlFor="note" hint="Internal. Shown next to the closure in the scheduler.">
          <input id="note" name="note" className={INPUT} />
        </Field>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className={BTN.primary}>
            {pending ? "Blocking…" : "Block This Time"}
          </button>
        </div>
      </form>

      {state?.error ? <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div> : null}

      {state?.ok ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning-bg p-3">
          <p className="os-eyebrow mb-1.5 text-warning">
            Closure saved · {state.affected?.length ?? 0} session
            {state.affected?.length === 1 ? "" : "s"} already scheduled in that window
          </p>
          {state.affected && state.affected.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-warning">
                Nothing was cancelled and nobody was notified. Review each one and decide.
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {state.affected.map((a) => (
                  <li key={a.id}>
                    {a.offeringId ? (
                      <Link href={`/os/offerings/${a.offeringId}?tab=schedule`} className="text-warning underline underline-offset-2">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="text-warning">{a.name}</span>
                    )}
                    <span className="text-warning">
                      {" "}· {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(a.start))}
                      {a.registrations > 0 ? ` · ${a.registrations} registered` : " · no registrations"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-warning">Nothing was scheduled in that window.</p>
          )}
        </div>
      ) : null}
    </>
  );
}
