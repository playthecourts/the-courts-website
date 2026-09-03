import { generateRecurringSessions } from "@/app/admin/programs/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Team = { id: string; name: string };

export function RecurringSessionForm({ programId, teams }: { programId: string; teams: Team[] }) {
  const action = generateRecurringSessions.bind(null, programId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <p className="w-full text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Recurring class — generates one session per week
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Starting
        <input type="date" name="startDate" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Day of week
        <select name="dayOfWeek" required defaultValue={3} className="rounded-md border border-neutral-300 px-2 py-1 text-sm">
          {DAYS.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Time
        <input type="time" name="time" defaultValue="17:00" required className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Duration (min)
        <input type="number" name="durationMinutes" defaultValue={60} min={1} required className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Weeks
        <input type="number" name="weeks" defaultValue={8} min={1} max={52} required className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Capacity
        <input type="number" name="capacity" defaultValue={12} min={1} required className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      {teams.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-medium">
          Team (optional)
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
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        Generate Sessions
      </button>
    </form>
  );
}
