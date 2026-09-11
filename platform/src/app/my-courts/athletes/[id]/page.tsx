import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import {
  displayName,
  birthdayMonth,
  coachingPreferenceLabels,
  competitiveMeterLabel,
} from "@/lib/athlete";

// The Player Card.
//
// This is the screen a kid leans over their parent's shoulder to look at, so it
// holds only the parts of the record that are fun to be known by: what they're
// working on, how they like to be coached, how competitive they are, what else
// they play, and their birthday month.
//
// Everything sensitive is absent BY CONSTRUCTION, not by a conditional: this
// component never reads medicalNotes, emergencyContacts, custodyRestrictions,
// authorizedPickups, mediaConsent or the full dob. The date of birth is present
// in the record and only its month is derived here.

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-mid px-4 py-3.5 first:border-t-0">
      <p className="mb-1 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
        {label}
      </p>
      <div className="font-body text-[15px] leading-snug text-near-black">{children}</div>
    </div>
  );
}

export default async function PlayerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const name = displayName(athlete);
  const prefs = coachingPreferenceLabels(athlete.coachingPreferences);
  const meter = competitiveMeterLabel(athlete.competitiveMeter);
  const sports = athlete.sports.length > 0 ? athlete.sports.join(" · ") : null;

  const anythingPersonal =
    athlete.goal || prefs.length > 0 || meter || athlete.otherSports.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
        {sports && <CardRow label="Sport">{sports}</CardRow>}
        {athlete.school && <CardRow label="School">{athlete.school}</CardRow>}
        {/* Month only — the full date of birth never renders here. */}
        <CardRow label="Birthday Month">{birthdayMonth(athlete.dob)}</CardRow>
      </div>

      {anythingPersonal ? (
        <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
          {athlete.goal && <CardRow label="Working On">{athlete.goal}</CardRow>}
          {prefs.length > 0 && (
            <CardRow label="Likes to Be Coached">
              <span className="flex flex-wrap gap-1.5">
                {prefs.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-gray-light px-2.5 py-1 text-[13.5px] text-near-black"
                  >
                    {p}
                  </span>
                ))}
              </span>
            </CardRow>
          )}
          {meter && <CardRow label="Competitive Meter">{meter}</CardRow>}
          {athlete.otherSports.length > 0 && (
            <CardRow label="Other Sports">{athlete.otherSports.join(" · ")}</CardRow>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-mid bg-white p-5 text-center">
          <p className="font-heading text-[15px] font-bold text-near-black">
            Tell us about {name}
          </p>
          <p className="mx-auto mt-1.5 max-w-[38ch] font-body text-[13.5px] leading-relaxed text-gray-dark">
            What they want to get better at, how they like to be coached — it&rsquo;s what their
            coaches read before a session.
          </p>
          <Link
            href={`/my-courts/athletes/${athlete.id}/edit/about`}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-orange px-5 font-sport text-[13px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            Add Their Details
          </Link>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <Link
          href={`/my-courts/athletes/${athlete.id}/edit/about`}
          className="text-center font-sport text-[12px] font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-orange"
        >
          Edit Player Card
        </Link>
        <span className="text-gray-mid">&middot;</span>
        <Link
          href={`/my-courts/athletes/${athlete.id}/edit/photo`}
          className="text-center font-sport text-[12px] font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-orange"
        >
          {athlete.photoPath ? "Change Photo" : "Add a Photo"}
        </Link>
      </div>
    </div>
  );
}
