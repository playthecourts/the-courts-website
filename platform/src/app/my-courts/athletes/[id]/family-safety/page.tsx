import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";

// Logistics and safety, not athlete/coaching info — that lives on the Player
// Card. Three sections on one page rather than three top-level tabs: each
// row says what's on file so a parent can see at a glance whether they've
// answered something without opening it.

export default async function FamilySafetyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const base = `/my-courts/athletes/${athlete.id}/edit`;
  const guardianCount = athlete.family.guardians.length;
  const pickupCount =
    athlete.family.guardians.filter((g) => g.authorizedForPickup).length +
    athlete.authorizedPickups.length;

  const sections = [
    {
      href: `${base}/safety`,
      label: "Emergency + Safety",
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
    </div>
  );
}
