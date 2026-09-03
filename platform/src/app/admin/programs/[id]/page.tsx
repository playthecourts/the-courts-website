import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateProgram } from "@/app/admin/programs/actions";
import { SessionRow } from "./session-row";
import { NewSessionForm } from "./new-session-form";
import { RecurringSessionForm } from "./recurring-session-form";

export default async function ProgramDetailPage(props: PageProps<"/admin/programs/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const program = await prisma.program.findUnique({
    where: { id },
    include: { sessions: { orderBy: { startTime: "asc" } } },
  });

  if (!program) notFound();

  const updateAction = updateProgram.bind(null, program.id);
  const upcoming = program.sessions.filter((s) => s.startTime >= new Date());
  const past = program.sessions.filter((s) => s.startTime < new Date());

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
          <NewSessionForm programId={program.id} />
          <RecurringSessionForm programId={program.id} />
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
