import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { displayName, fullName, completeness } from "@/lib/athlete";
import ProfileTabs from "./profile-tabs";

// The athlete header + tabs, shared by every tab below it.
//
// Rendering the header here rather than in each tab means the athlete's face
// and name stay put while the content under them changes — the profile reads as
// one place instead of five pages that happen to be about the same child.

export default async function AthleteProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const photoUrl = await signedPhotoUrl(athlete.photoPath);
  const name = displayName(athlete);

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
    <div>
      <Link
        href="/my-courts/athletes"
        className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
      >
        &larr; My Athletes
      </Link>

      <div className="mt-4 mb-5 flex items-center gap-4">
        <AthleteAvatar athlete={athlete} photoUrl={photoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-[1.06] font-black tracking-tight text-near-black">
            {name}
          </h1>
          <p className="mt-0.5 font-body text-[14px] text-gray-dark">
            {[fullName(athlete) !== name ? fullName(athlete) : null, athlete.grade ? `${athlete.grade} Grade` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* The nudge — never a gate. Nothing on this list blocks booking. */}
      {progress.nextStep && (
        <Link
          href={progress.nextStep.href}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-orange/40 bg-orange/5 px-4 py-3.5"
        >
          <div className="min-w-0">
            <p className="font-heading text-[14.5px] font-bold text-near-black">
              Finish {name}&rsquo;s profile
            </p>
            <p className="mt-0.5 font-body text-[13px] text-gray-dark">
              Next: {progress.nextStep.label} · {progress.done} of {progress.total} done
            </p>
          </div>
          <span className="font-sport text-[11px] font-bold uppercase tracking-[0.1em] text-orange">
            Continue
          </span>
        </Link>
      )}

      <ProfileTabs athleteId={athlete.id} />
      {children}
    </div>
  );
}
