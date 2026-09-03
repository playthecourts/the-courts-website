"use client";

import { useActionState } from "react";
import { createProgram } from "@/app/admin/programs/actions";

export function NewProgramForm() {
  const [, formAction, pending] = useActionState(createProgram, undefined);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          name="name"
          required
          placeholder="Wednesday Basketball Development"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <select name="programType" required className="rounded-md border border-neutral-300 px-3 py-2 text-base">
          <option value="class">Class</option>
          <option value="camp">Camp</option>
          <option value="league">League</option>
          <option value="private">Private</option>
          <option value="resource">Resource</option>
          <option value="rental">Rental</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Sport (optional)
        <input name="sport" placeholder="Basketball" className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description (optional)
        <textarea name="description" rows={3} className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Price ($)
          <input name="price" type="number" step="0.01" min="0" className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Member price ($, optional)
          <input name="memberPrice" type="number" step="0.01" min="0" className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create program"}
      </button>
    </form>
  );
}
