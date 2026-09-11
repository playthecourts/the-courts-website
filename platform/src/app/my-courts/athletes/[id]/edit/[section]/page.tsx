import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { displayName } from "@/lib/athlete";
import PhotoPicker from "@/components/athlete/photo-picker";
import AboutForm from "@/components/athlete/forms/about-form";
import SafetyForm from "@/components/athlete/forms/safety-form";
import CustodyForm from "@/components/athlete/forms/custody-form";
import GuardiansForm from "@/components/athlete/forms/guardians-form";
import PickupForm from "@/components/athlete/forms/pickup-form";
import PrivacyForm from "@/components/athlete/forms/privacy-form";
import { StepHeader } from "@/components/athlete/form-ui";

// One route for every editable section.
//
// The same form components serve the first-run setup flow and later edits — the
// only difference is the chrome around them and where "save" goes next. That
// keeps a parent's second visit to Safety identical to their first, which is
// the whole reason the setup flow doesn't get its own private copies.
//
// player-card bundles Photo + About + Coaching on one screen: those are the
// "who is this athlete" questions, and a parent shouldn't have to visit three
// separate destinations to answer them.

const SECTIONS = ["player-card", "safety", "guardians", "pickup", "privacy"] as const;
type Section = (typeof SECTIONS)[number];

export default async function EditSectionPage({
  params,
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const name = displayName(athlete);
  const back = `/my-courts/athletes/${athlete.id}`;
  const done =
    section === "player-card"
      ? back
      : section === "privacy"
        ? `${back}/waivers`
        : `${back}/family-safety`;

  const guardianRows = athlete.family.guardians.map((fg) => ({
    id: fg.guardian.id,
    name: fg.guardian.name,
    email: fg.guardian.email,
    phone: fg.guardian.phone,
    relationship: fg.relationship,
    isPrimary: fg.isPrimary,
    authorizedForPickup: fg.authorizedForPickup,
    hasLogin: Boolean(fg.guardian.authId),
  }));

  return (
    <div>
      <Link
        href={done}
        className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
      >
        &larr; Back
      </Link>

      <div className="mt-4">
        {section === "player-card" && (
          <>
            <PhotoPicker
              athlete={athlete}
              athleteId={athlete.id}
              currentPhotoUrl={await signedPhotoUrl(athlete.photoPath)}
              nextHref={done}
              eyebrow="Photo"
              title={athlete.photoPath ? "Change Photo" : "Add a Photo"}
              sub="Makes it easier for coaches to put names to faces."
            />
            <div className="my-8 border-t border-gray-mid pt-2" />
            <AboutForm
              athlete={athlete}
              displayName={name}
              nextHref={done}
              sections="all"
              eyebrow="About + Coaching"
              title={`About ${name}`}
              submitLabel="Save"
            />
          </>
        )}

        {section === "safety" && (
          <>
            <SafetyForm
              athlete={athlete}
              displayName={name}
              guardians={guardianRows}
              nextHref={done}
              title="Safety + Emergency"
              submitLabel="Save"
            />
            <div className="my-8 border-t border-gray-mid pt-2" />
            <CustodyForm athlete={athlete} nextHref={done} />
          </>
        )}

        {section === "guardians" && (
          <>
            <StepHeader title="Parents + Guardians" />
            <GuardiansForm athleteId={athlete.id} guardians={guardianRows} nextHref={done} />
          </>
        )}

        {section === "pickup" && (
          <>
            <StepHeader title="Authorized Pickup" />
            <PickupForm
              athleteId={athlete.id}
              displayName={name}
              guardianPickups={guardianRows}
              people={athlete.authorizedPickups}
            />
          </>
        )}

        {section === "privacy" && (
          <PrivacyForm
            athlete={athlete}
            displayName={name}
            currentStatus={athlete.mediaConsent?.status ?? null}
            currentRelationship={athlete.mediaConsent?.guardianRelationship ?? null}
            nextHref={done}
          />
        )}
      </div>
    </div>
  );
}
