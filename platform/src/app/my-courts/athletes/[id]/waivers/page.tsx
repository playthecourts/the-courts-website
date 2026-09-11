import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

// The parent's record of what they've agreed to for this athlete — legal
// waivers (signed once, permanent) kept visually distinct from permissions
// (a choice that can be changed later). Both live here rather than on the
// Player Card because neither is information that helps a coach train this
// kid; both are consent records.

export default async function AthleteWaiversPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const guardian = await getCurrentGuardian();

  const waivers = await prisma.waiver.findMany({
    where: { required: true },
    orderBy: { waiverType: "asc" },
    include: {
      signatures: {
        where: { guardianId: guardian.id, OR: [{ athleteId: null }, { athleteId: athlete.id }] },
      },
    },
  });

  const mediaConsent = athlete.mediaConsent;
  const editBase = `/my-courts/athletes/${athlete.id}/edit`;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Waivers
        </p>
        <div className="flex flex-col gap-2.5">
          {waivers.map((waiver) => {
            const signature = waiver.signatures[0];
            return signature ? (
              <div
                key={waiver.id}
                className="rounded-xl border border-gray-mid bg-white px-4 py-3.5"
              >
                <p className="font-heading text-[15px] font-bold text-near-black">
                  {waiver.waiverType}
                </p>
                <p className="mt-0.5 font-body text-[13px] text-gray-dark">
                  &#10003; Signed {formatDate(signature.signedAt)}
                </p>
              </div>
            ) : (
              <Link
                key={waiver.id}
                href="/my-courts/waivers"
                className="flex items-center justify-between gap-3 rounded-xl border border-orange/40 bg-orange/5 px-4 py-3.5"
              >
                <div>
                  <p className="font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                    Action Needed
                  </p>
                  <p className="mt-0.5 font-heading text-[15px] font-bold text-near-black">
                    {waiver.waiverType}
                  </p>
                </div>
                <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                  Complete &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Permissions
        </p>
        {mediaConsent ? (
          <div className="rounded-xl border border-gray-mid bg-white px-4 py-3.5">
            <p className="font-heading text-[15px] font-bold text-near-black">Photo + Video</p>
            <p className="mt-0.5 font-body text-[13px] text-gray-dark">
              {mediaConsent.status === "media_ok" ? "Allowed" : "Not allowed"} &middot; Updated{" "}
              {formatDate(mediaConsent.updatedAt)}
            </p>
            <Link
              href={`${editBase}/privacy`}
              className="mt-2 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase"
            >
              Change &rarr;
            </Link>
          </div>
        ) : (
          <Link
            href={`${editBase}/privacy`}
            className="flex items-center justify-between gap-3 rounded-xl border border-orange/40 bg-orange/5 px-4 py-3.5"
          >
            <div>
              <p className="font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                Action Needed
              </p>
              <p className="mt-0.5 font-heading text-[15px] font-bold text-near-black">
                Photo + Video Permission
              </p>
            </div>
            <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
              Review &rarr;
            </span>
          </Link>
        )}
      </section>
    </div>
  );
}
