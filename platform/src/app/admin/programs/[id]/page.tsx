import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateProgram } from "@/app/admin/programs/actions";
import { SessionRow } from "./session-row";
import { NewSessionForm } from "./new-session-form";
import { RecurringSessionForm } from "./recurring-session-form";
import { TeamRow } from "./team-row";
import { NewTeamForm } from "./new-team-form";

export default async function ProgramDetailPage(props: PageProps<"/admin/programs/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const [program, allAthletes] = await Promise.all([
    prisma.program.findUnique({
      where: { id },
      include: {
        sessions: { orderBy: { startTime: "asc" }, include: { team: true } },
        teams: {
          orderBy: { name: "asc" },
          include: { members: { include: { athlete: true }, orderBy: { athlete: { firstName: "asc" } } } },
        },
      },
    }),
    prisma.athlete.findMany({ orderBy: { firstName: "asc" } }),
  ]);

  if (!program) notFound();

  const updateAction = updateProgram.bind(null, program.id);
  const upcoming = program.sessions.filter((s) => s.startTime >= new Date());
  const past = program.sessions.filter((s) => s.startTime < new Date());
  const isLeague = program.programType === "league";

  return (
    <div className="flex flex-col gap-8">
      <form action={updateAction} className="flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            defaultValue={program.name}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-lg font-bold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select
            name="programType"
            defaultValue={program.programType}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          >
            <option value="class">Class</option>
            <option value="camp">Camp</option>
            <option value="league">League</option>
            <option value="private">Private</option>
            <option value="resource">Resource</option>
            <option value="rental">Rental</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sport
          <input name="sport" defaultValue={program.sport ?? ""} className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            name="description"
            defaultValue={program.description ?? ""}
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Price ($)
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={program.priceCents !== null ? (program.priceCents / 100).toFixed(2) : ""}
              className="rounded-md border border-neutral-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Member price ($)
            <input
              name="memberPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={program.memberPriceCents !== null ? (program.memberPriceCents / 100).toFixed(2) : ""}
              className="rounded-md border border-neutral-300 px-3 py-2 text-base"
            />
          </label>
        </div>
        <button type="submit" className="w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          Save
        </button>
      </form>

      {isLeague && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Teams
          </h2>
          <div className="mb-4 rounded-lg border border-neutral-200">
            {program.teams.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-500">
                No teams yet — form teams after evaluations, then assign practice/game sessions to them below.
              </p>
            ) : (
              program.teams.map((team) => (
                <TeamRow
                  key={team.id}
                  teamId={team.id}
                  programId={program.id}
                  name={team.name}
                  division={team.division}
                  members={team.members}
                  allAthletes={allAthletes}
                />
              ))
            )}
          </div>
          <NewTeamForm programId={program.id} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Upcoming Sessions ({upcoming.length})
        </h2>
        <div className="mb-4 rounded-lg border border-neutral-200">
          {upcoming.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No upcoming sessions.</p>
          ) : (
            upcoming.map((session) => <SessionRow key={session.id} session={session} />)
          )}
        </div>

        <div className="flex flex-col gap-3">
          <NewSessionForm programId={program.id} teams={program.teams} />
          <RecurringSessionForm programId={program.id} teams={program.teams} />
        </div>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Past Sessions ({past.length})
          </h2>
          <div className="rounded-lg border border-neutral-200">
            {past.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
