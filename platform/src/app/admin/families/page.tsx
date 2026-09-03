import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export default async function FamiliesPage() {
  await getCurrentStaff();

  const families = await prisma.family.findMany({
    orderBy: { name: "asc" },
    include: {
      athletes: true,
      guardians: { include: { guardian: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Families</h1>
        <Link
          href="/admin/families/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          + New Family
        </Link>
      </div>

      {families.length === 0 ? (
        <p className="text-sm text-neutral-500">No families yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {families.map((family) => (
            <Link
              key={family.id}
              href={`/admin/families/${family.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="font-medium">{family.name}</p>
                <p className="text-sm text-neutral-500">
                  {family.guardians.map((g) => g.guardian.name).join(", ") || "No guardians"}
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {family.athletes.length} athlete{family.athletes.length === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
