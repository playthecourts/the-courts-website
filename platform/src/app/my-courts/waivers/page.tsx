import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { SignForm } from "./sign-form";

export default async function WaiversPage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  const waivers = await prisma.waiver.findMany({
    orderBy: { waiverType: "asc" },
    include: {
      signatures: {
        where: { guardianId: guardian.id },
      },
    },
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Waivers</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Required waivers must be signed before booking a session.
      </p>

      {waivers.length === 0 ? (
        <p className="text-sm text-neutral-500">No waivers on file.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {waivers.map((waiver) => {
            const familySignature = waiver.signatures.find((s) => s.athleteId === null);

            return (
              <section key={waiver.id} className="rounded-lg border border-neutral-200 p-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold">
                    {waiver.waiverType}
                    {!waiver.required && (
                      <span className="ml-2 text-xs font-normal text-neutral-400">(optional)</span>
                    )}
                  </h2>
                  <span className="text-xs text-neutral-400">v{waiver.version}</span>
                </div>

                <div className="mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
                  {waiver.content}
                </div>

                {waiver.scope === "family" ? (
                  familySignature ? (
                    <p className="text-sm text-green-700">
                      Signed by {familySignature.signedName} on{" "}
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(familySignature.signedAt)}
                    </p>
                  ) : (
                    <SignForm waiverId={waiver.id} athleteId={null} label="Covers your whole family" />
                  )
                ) : (
                  <div className="flex flex-col gap-2">
                    {athletes.map((athlete) => {
                      const signature = waiver.signatures.find((s) => s.athleteId === athlete.id);
                      return signature ? (
                        <p key={athlete.id} className="text-sm text-green-700">
                          {athlete.firstName}: signed by {signature.signedName} on{" "}
                          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(signature.signedAt)}
                        </p>
                      ) : (
                        <SignForm
                          key={athlete.id}
                          waiverId={waiver.id}
                          athleteId={athlete.id}
                          label={athlete.firstName}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
