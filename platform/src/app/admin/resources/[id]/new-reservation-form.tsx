import { createReservation } from "@/app/admin/resources/actions";

type Family = { id: string; name: string };

export function NewReservationForm({ resourceId, families }: { resourceId: string; families: Family[] }) {
  const action = createReservation.bind(null, resourceId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <p className="w-full text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Ad-hoc rental (not tied to a class/camp/league)
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Family
        <select name="familyId" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
          <option value="">Select family…</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Start
        <input type="datetime-local" name="startTime" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Duration (min)
        <input type="number" name="durationMinutes" defaultValue={60} min={1} required className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Reserve
      </button>
    </form>
  );
}
