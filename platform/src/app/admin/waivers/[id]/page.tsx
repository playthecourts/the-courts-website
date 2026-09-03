import { notFound } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateWaiver } from "@/app/admin/waivers/actions";

export default async function WaiverDetailPage(props: PageProps<"/admin/waivers/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const waiver = await prisma.waiver.findUnique({
    where: { id },
    include: {
      signatures: {
        orderBy: { signedAt: "desc" },
        include: { guardian: true, athlete: true },
      },
    },
  });

  if (!waiver) notFound();

  const updateAction = updateWaiver.bind(null, waiver.id);

  return (
    <div className="flex flex-col gap-8">
      <form action={updateAction} className="flex max-w-lg flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Waiver type
          <input
            name="waiverType"
            defaultValue={waiver.waiverType}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-lg font-bold"
          />
        </label>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Version
            <input name="version" defaultValue={waiver.version} required className="rounded-md border border-neutral-300 px-3 py-2 text-base" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Effective date
            <input
              type="date"
              name="effectiveDate"
              defaultValue={waiver.effectiveDate.toISOString().slice(0, 10)}
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-base"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Scope
          <select name="scope" defaultValue={waiver.scope} required className="rounded-md border border-neutral-300 px-3 py-2 text-base">
            <option value="family">Family — one signature covers every athlete</option>
            <option value="athlete">Athlete — signed once per athlete</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="required" defaultChecked={waiver.required} className="h-4 w-4" />
          Required before booking
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Content
          <textarea
            name="content"
            defaultValue={waiver.content}
            required
            rows={10}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          Save
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Signatures ({waiver.signatures.length})
        </h2>
        <div className="rounded-lg border border-neutral-200">
          {waiver.signatures.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No one has signed yet.</p>
          ) : (
            waiver.signatures.map((sig) => (
              <div key={sig.id} className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
                <span>
                  {sig.guardian.name}
                  {sig.athlete && (
                    <span className="text-neutral-500">
                      {" "}
                      for {sig.athlete.firstName} {sig.athlete.lastName}
                    </span>
                  )}
                  <span className="text-neutral-400"> — signed as &ldquo;{sig.signedName}&rdquo;</span>
                </span>
                <span className="text-neutral-500">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(sig.signedAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
