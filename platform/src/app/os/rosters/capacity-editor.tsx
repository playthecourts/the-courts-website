"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rosterSetCapacity } from "./actions";

// "Edit" under the seat count on a Class Rosters card: type a new capacity for
// this one class and save.
export function CapacityEditor({ sessionId, capacity, booked }: { sessionId: string; capacity: number; booked: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(capacity));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    const n = Number(value);
    start(async () => {
      const res = await rosterSetCapacity(sessionId, n);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(String(capacity)); setEditing(true); }}
        className="text-xs text-gray-dark underline underline-offset-2 hover:text-near-black"
      >
        Edit capacity
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`cap-${sessionId}`}>Capacity</label>
        <input
          id={`cap-${sessionId}`}
          type="number"
          min={Math.max(1, booked)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          className="os-num w-16 rounded-md border border-gray-mid px-2 py-1 text-sm"
          autoFocus
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="os-heading inline-flex min-h-9 items-center rounded-full bg-near-black px-3 text-xs uppercase tracking-wide text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="text-xs text-gray-dark underline">
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
