import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { displayName } from "@/lib/athlete";
import PhotoPicker from "@/components/athlete/photo-picker";
import AboutForm from "@/components/athlete/forms/about-form";
import SafetyForm from "@/components/athlete/forms/safety-form";
import { AthleteAvatar } from "@/components/athlete/avatar";

// The first-run flow, deliberately OUTSIDE /athletes/[id] so it doesn't inherit
// the profile's tabs and "finish your profile" nudge. A parent adding a child
// should see one question at a time and a way out, not a half-built profile
// urging them to finish the thing they are in the middle of.
//
// Three steps, and only the first one is required to have a usable athlete.
// Every later step offers Finish Later and loses nothing. Photo + Video
// Permission is NOT here — it's a consent choice, not profile information,
// and lives under Action Needed / My Athletes > Privacy + Permissions instead.

const STEPS = ["photo", "about", "safety", "done"] as const;
type Step = (typeof STEPS)[number];

const NEXT: Record<Exclude<Step, "done">, Step> = {
  photo: "about",
  about: "safety",
  safety: "done",
};

const STEP_NUMBER: Record<Step, string | undefined> = {
  photo: "Step 2 of 3",
  about: "Step 3 of 3",
  safety: "Last one",
  done: undefined,
};

export default async function SetupStepPage({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  const { id, step } = await params;
  if (!STEPS.includes(step as Step)) notFound();

  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const name = displayName(athlete);
  const profile = `/my-courts/athletes/${athlete.id}`;
  const setupBase = `/my-courts/athletes/setup/${athlete.id}`;
  const current = step as Step;
  const nextHref = current === "done" ? profile : `${setupBase}/${NEXT[current]}`;

  if (current === "done") {
    const photoUrl = await signedPhotoUrl(athlete.photoPath);
    return (
      <div className="py-6 text-center">
        <div className="mb-5 flex justify-center">
          <AthleteAvatar athlete={athlete} photoUrl={photoUrl} size="xl" />
        </div>
        <h1 className="font-display text-[32px] leading-[1.05] font-black tracking-tight text-near-black">
          They&rsquo;re In.
        </h1>
        <p className="mx-auto mt-2 max-w-[34ch] font-body text-[15px] leading-relaxed text-gray-dark">
          {name}&rsquo;s Courts profile is ready.
        </p>

        <div className="mx-auto mt-7 flex max-w-sm flex-col gap-2.5">
          <Link
            href={profile}
            className="flex min-h-[52px] items-center justify-center rounded-lg bg-orange px-5 font-sport text-[15px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            View Their Profile
          </Link>
          <Link
            href="/my-courts/explore"
            className="flex min-h-[50px] items-center justify-center rounded-lg border border-gray-mid bg-white px-5 font-sport text-[14px] font-bold uppercase tracking-wide text-gray-dark hover:border-gray-dark hover:text-near-black"
          >
            Find Something to Do
          </Link>
          <Link
            href="/my-courts/athletes/new"
            className="flex min-h-[50px] items-center justify-center rounded-lg border border-gray-mid bg-white px-5 font-sport text-[14px] font-bold uppercase tracking-wide text-gray-dark hover:border-gray-dark hover:text-near-black"
          >
            Add Another Athlete
          </Link>
        </div>
      </div>
    );
  }

  const guardianRows = athlete.family.guardians.map((fg) => ({
    id: fg.guardian.id,
    name: fg.guardian.name,
    phone: fg.guardian.phone,
    relationship: fg.relationship,
  }));

  return (
    <div>
      {current === "photo" && (
        <PhotoPicker
          athlete={athlete}
          athleteId={athlete.id}
          nextHref={nextHref}
          skipHref={nextHref}
          eyebrow={STEP_NUMBER[current]}
        />
      )}

      {current === "about" && (
        <AboutForm
          athlete={athlete}
          displayName={name}
          nextHref={nextHref}
          eyebrow={STEP_NUMBER[current]}
        />
      )}

      {current === "safety" && (
        <SafetyForm
          athlete={athlete}
          displayName={name}
          guardians={guardianRows}
          nextHref={nextHref}
          eyebrow={STEP_NUMBER[current]}
        />
      )}

      {/* Always available, never a dead end — the athlete already exists and
          works; the rest can wait for a quieter evening. */}
      <div className="mt-5 text-center">
        <Link
          href={profile}
          className="font-sport text-[12.5px] font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-orange"
        >
          Finish Later
        </Link>
      </div>
    </div>
  );
}
