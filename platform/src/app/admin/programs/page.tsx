import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

function formatPrice(cents: number | null) {
  if (cents === null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ProgramsPage() {
  await getCurrentStaff();

  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Programs</h1>
        <Link
          href="/admin/programs/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          + New Program
        </Link>
      </div>

      {programs.length === 0 ? (
        <p className="text-sm text-neutral-500">No programs yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/admin/programs/${program.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="font-medium">
                  {program.name}
                  {!program.active && (
                    <span className="ml-2 text-xs font-normal text-neutral-400">(inactive)</span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">
                  {program.programType}
                  {program.sport ? ` · ${program.sport}` : ""} · {formatPrice(program.priceCents)}
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {program._count.sessions} session{program._count.sessions === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
