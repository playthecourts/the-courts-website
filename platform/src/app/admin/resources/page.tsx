import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export default async function ResourcesPage() {
  await getCurrentStaff();

  const resources = await prisma.resource.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sessions: true, reservations: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Resources</h1>
        <Link
          href="/admin/resources/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          + New Resource
        </Link>
      </div>

      {resources.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No resources yet — e.g. Court 1, Court 2, Full Court, Dr. Dish.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {resources.map((resource) => (
            <Link
              key={resource.id}
              href={`/admin/resources/${resource.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="font-medium">
                  {resource.name}
                  {!resource.active && (
                    <span className="ml-2 text-xs font-normal text-neutral-400">(inactive)</span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{resource.resourceType}</p>
              </div>
              <span className="text-sm text-neutral-500">
                {resource._count.sessions + resource._count.reservations} booking
                {resource._count.sessions + resource._count.reservations === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
