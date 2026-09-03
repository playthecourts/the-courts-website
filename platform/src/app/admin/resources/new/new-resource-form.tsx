"use client";

import { useActionState } from "react";
import { createResource } from "@/app/admin/resources/actions";

export function NewResourceForm() {
  const [, formAction, pending] = useActionState(createResource, undefined);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input name="name" required placeholder="Dr. Dish" className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Type
        <input
          name="resourceType"
          required
          placeholder="shooting_machine, court, full_court…"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Capacity
        <input name="capacity" type="number" min="1" defaultValue={1} className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create resource"}
      </button>
    </form>
  );
}
