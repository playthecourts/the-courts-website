import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { scopedSports } from "@/lib/os/permissions";
import { CREATE_PICKER_ORDER, programTypeDef } from "@/lib/programs/types";
import { PageHeader, Card } from "../../_components/ui";
import { NewOfferingForm } from "./new-offering-form";

export const dynamic = "force-dynamic";

// Step 1 is a visual picker, not a form. The selected type decides which
// workflow follows, so asking it first is what lets every later screen show
// only fields that apply — nobody creating a Guided Dr. Dish session should
// ever see league settings.

export default async function NewProgramPage({ searchParams }: PageProps<"/os/programs/new">) {
  const actor = await requireCapability("programs.create");
  const sp = await searchParams;
  const chosen = typeof sp.type === "string" ? sp.type : null;

  const sports = scopedSports(actor);

  if (!chosen) {
    const training = CREATE_PICKER_ORDER.filter((t) => programTypeDef(t).category === "training");
    const recreation = CREATE_PICKER_ORDER.filter((t) => programTypeDef(t).category === "recreation");

    return (
      <div>
        <PageHeader
          eyebrow="Create"
          title="What are we making?"
          subtitle="Pick the kind of thing first — it decides what we ask you for next."
        />

        {[
          { heading: "Coach-led", note: "Instructional programming.", types: training },
          { heading: "Facility + Recreation", note: "Participation and facility use.", types: recreation },
        ].map((group) => (
          <section key={group.heading} className="mb-8">
            <h2 className="os-eyebrow mb-1 text-gray-dark">{group.heading}</h2>
            <p className="mb-3 text-sm text-neutral">{group.note}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.types.map((type) => {
                const def = programTypeDef(type);
                return (
                  <Link
                    key={type}
                    href={`/os/programs/new?type=${type}`}
                    className="group rounded-xl border border-gray-mid bg-white p-4 transition-colors hover:border-orange"
                  >
                    <p className="os-heading text-base text-near-black group-hover:text-orange">
                      {def.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-gray-dark">{def.tagline}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const def = programTypeDef(chosen as never);

  // Existing definitions of this type — picking one makes the new thing a new
  // SEASON rather than a duplicate program.
  const existingPrograms = await prisma.program.findMany({
    where: {
      programType: def.type,
      archivedAt: null,
      ...(sports && sports.length > 0 ? { sport: { in: sports } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sport: true,
      _count: { select: { offerings: true } },
    },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow={
          <>
            <Link href="/os/programs/new" className="underline underline-offset-2">
              Create
            </Link>
            {` · ${def.label}`}
          </>
        }
        title={`New ${def.label}`}
        subtitle={def.tagline}
      />
      <Card className="p-5">
        <NewOfferingForm
          programType={def.type}
          defaultSport={sports && sports.length === 1 ? sports[0] : null}
          allowedSports={sports}
          existingPrograms={existingPrograms}
        />
      </Card>
    </div>
  );
}
