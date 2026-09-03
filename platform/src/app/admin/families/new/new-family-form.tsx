"use client";

import { useActionState } from "react";
import { createFamily } from "@/app/admin/actions";

export function NewFamilyForm() {
  const [, formAction, pending] = useActionState(createFamily, undefined);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Family name
        <input
          type="text"
          name="name"
          required
          placeholder="The Smith Family"
          className="rounded-md border border-neutral-300 px-3 py-2 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create family"}
      </button>
    </form>
  );
}
