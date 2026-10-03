"use client";

import { useActionState, useState } from "react";
import { updateParentContact, type AddParentState } from "./actions";

const input =
  "w-full rounded-md border border-gray-mid bg-white px-3 py-2 text-sm text-near-black focus:border-near-black focus:outline-none";

type Props = {
  familyId: string;
  guardianId: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  hasLogin: boolean;
};

// "Edit" under a parent on the Family page: fix their name, phone,
// relationship, or (if they haven't signed in yet) email.
export function EditParent(p: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddParentState, FormData>(updateParentContact, null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="os-eyebrow mt-1 mr-3 inline-block text-gray-dark underline underline-offset-2">
        Edit
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="familyId" value={p.familyId} />
      <input type="hidden" name="guardianId" value={p.guardianId} />
      <label className="text-xs text-gray-dark">
        Name
        <input name="name" required defaultValue={p.name} className={input} />
      </label>
      <label className="text-xs text-gray-dark">
        Relationship
        <input name="relationship" defaultValue={p.relationship ?? ""} className={input} placeholder="Mom, Dad…" />
      </label>
      <label className="text-xs text-gray-dark">
        Phone
        <input name="phone" type="tel" defaultValue={p.phone ?? ""} className={input} />
      </label>
      <label className="text-xs text-gray-dark">
        Email{p.hasLogin ? " (their login — they change it)" : ""}
        <input name="email" type="email" defaultValue={p.email ?? ""} disabled={p.hasLogin} className={`${input} disabled:bg-warm-stone`} />
      </label>
      {state?.error ? <p className="text-sm text-danger sm:col-span-2">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success sm:col-span-2">{state.ok}</p> : null}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="os-heading rounded-full bg-near-black px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-dark underline">
          Close
        </button>
      </div>
    </form>
  );
}
