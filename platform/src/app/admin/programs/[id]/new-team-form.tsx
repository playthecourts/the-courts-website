import { createTeam } from "@/app/admin/programs/[id]/team-actions";

export function NewTeamForm({ programId }: { programId: string }) {
  const action = createTeam.bind(null, programId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 p-4">
      <label className="flex flex-col gap-1 text-xs font-medium">
        Team name
        <input name="name" required placeholder="3rd-4th Grade Boys" className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Division (optional)
        <input name="division" placeholder="3rd-4th Grade" className="rounded-md border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        + Add Team
      </button>
    </form>
  );
}
