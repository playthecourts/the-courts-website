import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { displayName } from "@/lib/athlete";
import { staffMediaLabel } from "@/lib/media-consent";

// Everything that isn't day-to-day, one level down.
//
// Each row says what's on file rather than just naming the section, so a parent
// can see at a glance whether they've answered something without opening it.

export default async function AthleteMorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const base = `/my-courts/athletes/${athlete.id}/edit`;
  const name = displayName(athlete);
  const guardianCount = athlete.family.guardians.length;
  const pickupCount =
    athlete.family.guardians.filter((g) => g.authorizedForPickup).length +
    athlete.authorizedPickups.length;

  const sections = [
    {
      href: `${base}/about`,
      label: "About",
      detail: athlete.goal ? athlete.goal : `What ${name} wants to get better at`,
    },
    {
      href: `${base}/coaching`,
      label: "Coaching",
      detail:
        athlete.coachingPreferences.length > 0
          ? `${athlete.coachingPreferences.length} preference${athlete.coachingPreferences.length === 1 ? "" : "s"} set`
          : "How they like to be coached",
    },
    {
      href: `${base}/safety`,
      label: "Safety + Emergency",
      detail: athlete.emergencyContacts[0]
        ? `${athlete.emergencyContacts[0].name} · ${athlete.emergencyContacts[0].phone}`
        : "No emergency contact yet",
    },
    {
      href: `${base}/guardians`,
      label: "Parents + Guardians",
      detail: `${guardianCount} on file`,
    },
    {
      href: `${base}/pickup`,
      label: "Authorized Pickup",
      detail: `${pickupCount} ${pickupCount === 1 ? "person" : "people"} authorized`,
    },
    {
      href: `${base}/privacy`,
      label: "Privacy + Permissions",
      detail: athlete.mediaConsent
        ? `Photos + video: ${staffMediaLabel(athlete.mediaConsent.status)}`
        : "Photos + video: not answered yet",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex items-center justify-between gap-3 px-4 py-4">
              <span className="min-w-0">
                <span className="block font-heading text-[15px] font-bold text-near-black">
                  {s.label}
                </span>
                <span className="mt-0.5 block truncate font-body text-[13.5px] text-gray-dark">
                  {s.detail}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 font-body text-[18px] text-gray-dark">
                &rsaquo;
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href={`${base}/photo`}
        className="text-center font-sport text-[12px] font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-orange"
      >
        {athlete.photoPath ? "Change Photo" : "Add a Photo"}
      </Link>
    </div>
  );
}
