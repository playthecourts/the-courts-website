"use client";

import { deleteTeam, addTeamMember, removeTeamMember } from "@/app/admin/programs/[id]/team-actions";

type Member = { athleteId: string; athlete: { firstName: string; lastName: string } };
type Athlete = { id: string; firstName: string; lastName: string };

export function TeamRow({
  teamId,
  programId,
  name,
  division,
  members,
  allAthletes,
}: {
  teamId: string;
  programId: string;
  name: string;
  division: string | null;
  members: Member[];
  allAthletes: Athlete[];
}) {
  const addAction = addTeamMember.bind(null, teamId, programId);
  const memberIds = new Set(members.map((m) => m.athleteId));
  const available = allAthletes.filter((a) => !memberIds.has(a.id));

  return (
    <div className="border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">
          {name}
          {division && <span className="ml-2 text-xs text-neutral-500">{division}</span>}
        </span>
        <button
          onClick={() => deleteTeam(teamId, programId)}
          className="text-xs font-medium text-red-600 underline"
        >
          Delete team
        </button>
      </div>

      {members.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {members.map((m) => (
            <li
              key={m.athleteId}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs"
            >
              {m.athlete.firstName} {m.athlete.lastName}
              <button
                onClick={() => removeTeamMember(teamId, m.athleteId, programId)}
                className="font-bold text-neutral-500 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form action={addAction} className="flex items-center gap-2">
          <select name="athleteId" required className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
            <option value="">Add athlete…</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-black px-2 py-1 text-xs font-semibold text-white">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
