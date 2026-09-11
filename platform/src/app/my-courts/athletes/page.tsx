import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { displayName, completeness } from "@/lib/athlete";

export default async function AthletesPage() {
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.familyId);

  // Read through the family scope rather than the guardian's nested include so
  // the new profile fields come along and the ownership rule stays in the query.
  const athletes = await prisma.athlete.findMany({
    where: { familyId: { in: familyIds } },
    include: {
      emergencyContacts: { select: { id: true } },
      mediaConsent: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const photoUrls = await signedPhotoUrls(athletes.map((a) => a.photoPath));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[26px] font-black tracking-tight text-near-black">
          My Athletes
        </h1>
        {athletes.length > 0 && (
          <Link
            href="/my-courts/athletes/new"
            className="flex min-h-[44px] shrink-0 items-center rounded-lg bg-orange px-4 font-sport text-[12.5px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            + Add
          </Link>
        )}
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-mid bg-white p-6 text-center">
          <p className="font-heading text-[16px] font-bold text-near-black">
            Let&rsquo;s get your athlete set up
          </p>
          <p className="mx-auto mt-2 max-w-[38ch] font-body text-[13.5px] leading-relaxed text-gray-dark">
            A few basics and they&rsquo;re on the roster. It takes about a minute.
          </p>
          <Link
            href="/my-courts/athletes/new"
            className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-orange px-6 font-sport text-[14px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            Add an Athlete
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {athletes.map((athlete) => {
            const progress = completeness(
              {
                photoPath: athlete.photoPath,
                goal: athlete.goal,
                coachingPreferences: athlete.coachingPreferences,
                competitiveMeter: athlete.competitiveMeter,
                emergencyContactCount: athlete.emergencyContacts.length,
              },
              athlete.id
            );
            return (
              <li key={athlete.id}>
                <Link
                  href={`/my-courts/athletes/${athlete.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-gray-mid bg-white px-4 py-3.5 hover:border-orange"
                >
                  <AthleteAvatar
                    athlete={athlete}
                    photoUrl={athlete.photoPath ? photoUrls.get(athlete.photoPath) : null}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-[15.5px] font-bold text-near-black">
                      {displayName(athlete)}
                    </span>
                    <span className="mt-0.5 block font-body text-[13.5px] text-gray-dark">
                      {[athlete.grade ? `${athlete.grade} Grade` : null, athlete.sports.join(" · ") || null]
                        .filter(Boolean)
                        .join(" · ") || "Profile started"}
                    </span>
                  </span>
                  {progress.nextStep && (
                    <span className="shrink-0 font-sport text-[10.5px] font-bold uppercase tracking-[0.1em] text-orange">
                      {progress.done}/{progress.total}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
