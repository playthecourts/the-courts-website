import { createSession } from "@/app/admin/programs/actions";

export function NewSessionForm({ programId }: { programId: string }) {
  const action = createSession.bind(null, programId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <p className="w-full text-xs font-semibold uppercase tracking-wide text-neutral-500">
        One-off session (fixed-date event)
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Start
        <input type="datetime-local" name="startTime" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Duration (min)
        <input type="number" name="durationMinutes" defaultValue={60} min={1} required className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Capacity
        <input type="number" name="capacity" defaultValue={12} min={1} required className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Add Session
      </button>
    </form>
  );
}
