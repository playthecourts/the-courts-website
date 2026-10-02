import { redirect } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";

// "Family Profile" — the one stable URL the account menu and Account page
// link to. Guardians, emergency contacts and pickup are edited per athlete
// (athletes/[id]/edit/[section]), so this lands on the guardians editor of
// the family's first athlete. No athletes yet means there's no family
// profile to edit — adding one IS the first step.
export default async function FamilyProfileRedirect() {
  const guardian = await getCurrentGuardian();
  const firstAthlete = guardian.families[0]?.family.athletes[0];
  redirect(firstAthlete ? `/my-courts/athletes/${firstAthlete.id}/edit/guardians` : "/my-courts/athletes/new");
}
