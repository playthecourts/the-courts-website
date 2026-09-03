import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export default async function WaiversPage() {
  await getCurrentStaff();

  const waivers = await prisma.waiver.findMany({
    orderBy: { waiverType: "asc" },
    include: { _count: { select: { signatures: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Waivers</h1>
        <Link
          href="/admin/waivers/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          + New Waiver
        </Link>
      </div>

      {waivers.length === 0 ? (
        <p className="text-sm text-neutral-500">No waivers yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {waivers.map((waiver) => (
            <Link
              key={waiver.id}
              href={`/admin/waivers/${waiver.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="font-medium">
                  {waiver.waiverType}
                  <span className="ml-2 text-xs font-normal text-neutral-400">v{waiver.version}</span>
                  {!waiver.required && (
                    <span className="ml-2 text-xs font-normal text-neutral-400">(optional)</span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{waiver.scope}-scope</p>
              </div>
              <span className="text-sm text-neutral-500">
                {waiver._count.signatures} signature{waiver._count.signatures === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
