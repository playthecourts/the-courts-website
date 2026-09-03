import { createAthlete } from "@/app/admin/actions";

export function NewAthleteForm({ familyId }: { familyId: string }) {
  const action = createAthlete.bind(null, familyId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <label className="flex flex-col gap-1 text-xs font-medium">
        First name
        <input name="firstName" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Last name
        <input name="lastName" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        DOB
        <input type="date" name="dob" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Grade
        <input name="grade" className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Gender
        <input name="gender" className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Add Athlete
      </button>
    </form>
  );
}
