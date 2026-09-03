import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export default async function AthletesPage() {
  await getCurrentStaff();

  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { family: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Athletes</h1>

      {athletes.length === 0 ? (
        <p className="text-sm text-neutral-500">No athletes yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {athletes.map((athlete) => (
            <Link
              key={athlete.id}
              href={`/admin/families/${athlete.familyId}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
            >
              <span className="font-medium">
                {athlete.firstName} {athlete.lastName}
                {athlete.grade && <span className="font-normal text-neutral-500"> — Grade {athlete.grade}</span>}
              </span>
              <span className="text-neutral-500">{athlete.family.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
