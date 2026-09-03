"use client";

import { useState } from "react";
import { updateAthlete, deleteAthlete } from "@/app/admin/actions";

type Athlete = {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  dob: Date;
  grade: string | null;
  gender: string | null;
};

export function AthleteRow({ athlete }: { athlete: Athlete }) {
  const [editing, setEditing] = useState(false);
  const updateAction = updateAthlete.bind(null, athlete.id);
  const deleteAction = deleteAthlete.bind(null, athlete.id, athlete.familyId);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await updateAction(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-end gap-3 border-b border-neutral-200 px-4 py-3"
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          First name
          <input
            name="firstName"
            defaultValue={athlete.firstName}
            required
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Last name
          <input
            name="lastName"
            defaultValue={athlete.lastName}
            required
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          DOB
          <input
            type="date"
            name="dob"
            defaultValue={athlete.dob.toISOString().slice(0, 10)}
            required
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Grade
          <input
            name="grade"
            defaultValue={athlete.grade ?? ""}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Gender
          <input
            name="gender"
            defaultValue={athlete.gender ?? ""}
            className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs font-medium text-neutral-500"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm">
      <div>
        <span className="font-medium">
          {athlete.firstName} {athlete.lastName}
        </span>
        {athlete.grade && <span className="text-neutral-500"> — Grade {athlete.grade}</span>}
      </div>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} className="font-medium underline">
          Edit
        </button>
        <form action={deleteAction}>
          <button type="submit" className="font-medium text-red-600 underline">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
