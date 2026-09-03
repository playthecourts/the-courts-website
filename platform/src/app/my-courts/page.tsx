import { getCurrentGuardian } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export default async function MyCourtsPage() {
  const guardian = await getCurrentGuardian();
  const families = guardian.families.map((fg) => fg.family);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {guardian.name}</h1>
          <p className="text-sm text-neutral-600">{guardian.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm font-medium underline">
            Sign out
          </button>
        </form>
      </div>

      {families.length === 0 ? (
        <p className="text-neutral-600">No family on file yet.</p>
      ) : (
        families.map((family) => (
          <section key={family.id} className="mb-8 rounded-lg border border-neutral-200 p-5">
            <h2 className="mb-3 text-lg font-semibold">{family.name}</h2>
            {family.athletes.length === 0 ? (
              <p className="text-sm text-neutral-500">No athletes added yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {family.athletes.map((athlete) => (
                  <li key={athlete.id} className="text-sm">
                    {athlete.firstName} {athlete.lastName}
                    {athlete.grade ? ` — Grade ${athlete.grade}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </main>
  );
}
