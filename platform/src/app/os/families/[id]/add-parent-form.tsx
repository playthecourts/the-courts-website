"use client";

import { useActionState, useState } from "react";
import { addParentToFamily, type AddParentState } from "./actions";

const input =
  "w-full rounded-md border border-gray-mid bg-white px-3 py-2 text-sm text-near-black focus:border-near-black focus:outline-none";

// "+ Add Parent" on the Family page. Opens a small form: name (required),
// email, phone, relationship, pickup.
export function AddParentForm({ familyId }: { familyId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddParentState, FormData>(addParentToFamily, null);

  if (!open) {
    return (
      <div className="border-t border-gray-mid px-4 py-3">
        {state?.ok ? <p className="mb-2 text-sm text-success">{state.ok}</p> : null}
        <button type="button" onClick={() => setOpen(true)} className="os-eyebrow text-orange underline underline-offset-2">
          + Add Parent
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 border-t border-gray-mid px-4 py-4 sm:grid-cols-2"
    >
      <input type="hidden" name="familyId" value={familyId} />
      <label className="text-xs text-gray-dark">
        Name*
        <input name="name" required className={input} placeholder="Brooke Gross" />
      </label>
      <label className="text-xs text-gray-dark">
        Relationship
        <input name="relationship" className={input} placeholder="Mom, Dad, Grandma…" />
      </label>
      <label className="text-xs text-gray-dark">
        Email
        <input name="email" type="email" className={input} />
      </label>
      <label className="text-xs text-gray-dark">
        Phone
        <input name="phone" type="tel" className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm text-near-black sm:col-span-2">
        <input type="checkbox" name="pickup" defaultChecked /> Allowed to pick up
      </label>
      {state?.error ? <p className="text-sm text-danger sm:col-span-2">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success sm:col-span-2">{state.ok}</p> : null}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="os-heading rounded-full bg-near-black px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add Parent"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-dark underline">
          Done
        </button>
      </div>
    </form>
  );
}
