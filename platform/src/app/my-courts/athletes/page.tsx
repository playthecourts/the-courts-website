import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";

export default async function AthletesPage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">My Athletes</h1>

      {athletes.length === 0 ? (
        <p className="font-body text-sm text-gray-dark">No athletes on file yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {athletes.map((athlete) => (
            <Link
              key={athlete.id}
              href={`/my-courts/athletes/${athlete.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-mid bg-white px-4 py-4 hover:border-orange"
            >
              <span className="font-heading font-bold text-black">
                {athlete.firstName} {athlete.lastName}
              </span>
              {athlete.grade && <span className="font-body text-sm text-gray-dark">Grade {athlete.grade}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
