import { createSession } from "@/app/admin/programs/actions";

type Team = { id: string; name: string };
type Resource = { id: string; name: string };

export function NewSessionForm({
  programId,
  teams,
  resources,
}: {
  programId: string;
  teams: Team[];
  resources: Resource[];
}) {
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
      {teams.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-medium">
          Team (optional — e.g. a practice/game)
          <select name="teamId" className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
            <option value="">Evaluation / no team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {resources.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-medium">
          Resource (optional)
          <select name="resourceId" className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
            <option value="">No resource</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Add Session
      </button>
    </form>
  );
}
