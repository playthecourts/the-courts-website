import { redirect } from "next/navigation";

// Superseded by the Home dashboard (/my-courts), which now shows everything
// this page used to — Family Header, Membership, Athletes, Guardians,
// Waivers + Permissions, Account + Billing, Messages — in one place. Kept as
// a redirect so any existing bookmark or link still lands somewhere real.
export default function FamilyPageRedirect() {
  redirect("/my-courts");
}
