import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { familyCrewInitials, familyCrewName } from "@/lib/family";
import { displayName } from "@/lib/athlete";

export default async function FamilyProfilePage() {
  const guardian = await getCurrentGuardian();
  const family = guardian.families[0]?.family ?? null;
  const crewName = familyCrewName(family?.name);
  const initials = familyCrewInitials(family?.name);
  const athletes = family?.athletes ?? [];

  // A guardian can belong to more than one family in the schema, but the
  // Parent App only ever shows the first — same assumption the rest of
  // my-courts already makes (see layout.tsx, page.tsx).
  const guardians = guardian.families[0]
    ? [{ id: guardian.id, name: guardian.name, email: guardian.email }]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-near-black font-display text-lg font-black text-white">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-xl font-black text-black">{crewName}</h1>
          <p className="font-body text-sm text-gray-dark">Family Account</p>
        </div>
      </div>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Guardians
        </p>
        <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3.5">
              <p className="font-heading text-sm font-bold text-near-black">{g.name}</p>
              <p className="font-body text-sm text-gray-dark">{g.email}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Athletes
        </p>
        {athletes.length > 0 ? (
          <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
            {athletes.map((a) => (
              <Link
                key={a.id}
                href={`/my-courts/athletes/${a.id}`}
                className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-light"
              >
                <p className="font-heading text-sm font-bold text-near-black">{displayName(a)}</p>
                <span className="font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                  View &rarr;
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-gray-mid bg-white px-4 py-3.5 font-body text-sm text-gray-dark">
            No athletes on this account yet.
          </p>
        )}
      </section>
    </div>
  );
}
