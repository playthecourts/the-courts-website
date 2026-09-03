import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateFamilyName } from "@/app/admin/actions";
import { AthleteRow } from "./athlete-row";
import { NewAthleteForm } from "./new-athlete-form";
import { AthleteMembershipBlock } from "./athlete-membership-block";

export default async function FamilyDetailPage(props: PageProps<"/admin/families/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const [family, plans] = await Promise.all([
    prisma.family.findUnique({
      where: { id },
      include: {
        athletes: {
          orderBy: { firstName: "asc" },
          include: { memberships: { include: { plan: true }, orderBy: { createdAt: "desc" } } },
        },
        guardians: { include: { guardian: true } },
      },
    }),
    prisma.membershipPlan.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!family) notFound();

  const updateNameAction = updateFamilyName.bind(null, family.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <form action={updateNameAction} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Family name
            <input
              name="name"
              defaultValue={family.name}
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-lg font-bold"
            />
          </label>
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Guardians
        </h2>
        {family.guardians.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No guardians linked yet. Guardian accounts are provisioned separately.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {family.guardians.map((fg) => (
              <li key={fg.guardianId}>
                {fg.guardian.name} — {fg.guardian.email}
                {fg.isPrimary && <span className="ml-2 text-xs text-neutral-500">(primary)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Athletes
        </h2>
        <div className="mb-4 rounded-lg border border-neutral-200">
          {family.athletes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No athletes yet.</p>
          ) : (
            family.athletes.map((athlete) => <AthleteRow key={athlete.id} athlete={athlete} />)
          )}
        </div>
        <NewAthleteForm familyId={family.id} />
      </section>

      {family.athletes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Memberships
          </h2>
          <div className="rounded-lg border border-neutral-200">
            {family.athletes.map((athlete) => (
              <AthleteMembershipBlock
                key={athlete.id}
                athleteId={athlete.id}
                athleteName={`${athlete.firstName} ${athlete.lastName}`}
                familyId={family.id}
                memberships={athlete.memberships}
                plans={plans}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
