"use client";

import { useActionState } from "react";
import { createWaiver } from "@/app/admin/waivers/actions";

export function NewWaiverForm() {
  const [, formAction, pending] = useActionState(createWaiver, undefined);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Waiver type
        <input
          name="waiverType"
          required
          placeholder="Participant Waiver & Release"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Version
          <input name="version" required defaultValue="1.0" className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Effective date
          <input type="date" name="effectiveDate" required className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Scope
        <select name="scope" required defaultValue="family" className="rounded-md border border-neutral-300 px-3 py-2 text-base">
          <option value="family">Family — one signature covers every athlete</option>
          <option value="athlete">Athlete — signed once per athlete</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="required" defaultChecked className="h-4 w-4" />
        Required before booking
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Content
        <textarea
          name="content"
          required
          rows={10}
          placeholder="Full waiver text…"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create waiver"}
      </button>
    </form>
  );
}
