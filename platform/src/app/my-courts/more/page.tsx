import Link from "next/link";
import { getCurrentGuardian, hasActiveStaffAccount } from "@/lib/dal";
import { familyCrewName, familyCrewInitials } from "@/lib/family";
import { logout } from "@/app/actions/auth";
import { openBillingPortal } from "../actions";
import { Icon, type IconName } from "../nav-link";

// Account — the phone's fifth tab (the route stays /my-courts/more so old
// links still land). Every destination that doesn't earn its own bottom tab,
// each with a real name: no junk drawer. On desktop these same places are in
// the sidebar and the account menu, so this page is mostly a phone thing —
// and it holds the phone's one and only Sign Out.

const PLACES: { href: string; icon: IconName; label: string; desc: string }[] = [
  { href: "/my-courts/memberships", icon: "membership", label: "Membership", desc: "Your plan, sessions left, and changes." },
  { href: "/my-courts/league", icon: "league", label: "Fall League", desc: "Registration, team, and game-day RSVPs." },
  { href: "/my-courts/payments", icon: "payments", label: "Payments", desc: "What's due and what's paid." },
  {
    href: "/my-courts/waivers",
    icon: "waivers",
    label: "Waivers + Permissions",
    desc: "Required forms and Photo + Video permission.",
  },
];

const rowClass = "flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-light";

function RowText({ label, desc }: { label: string; desc: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm font-bold text-near-black">{label}</span>
        <span className="block font-body text-xs text-gray-dark">{desc}</span>
      </span>
      <span className="font-body text-gray-dark" aria-hidden="true">
        &rarr;
      </span>
    </>
  );
}

export default async function AccountPage() {
  const [guardian, showAdminSwitch] = await Promise.all([getCurrentGuardian(), hasActiveStaffAccount()]);
  const familyName = guardian.families[0]?.family.name ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-near-black font-display text-lg font-black text-white">
          {familyCrewInitials(familyName)}
        </span>
        <div className="min-w-0">
          <p className="font-sport text-xs font-bold uppercase tracking-wide text-orange">Account</p>
          <h1 className="truncate font-display text-2xl font-black text-black">{familyCrewName(familyName)}</h1>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
        {PLACES.map((item) => (
          <Link key={item.href} href={item.href} className={rowClass}>
            <Icon name={item.icon} active={false} />
            <RowText label={item.label} desc={item.desc} />
          </Link>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
        <Link href="/my-courts/family" className={rowClass}>
          <Icon name="family" active={false} />
          <RowText label="Family Profile" desc="Parents + guardians on your account." />
        </Link>
        <form action={openBillingPortal}>
          <button type="submit" className={rowClass}>
            <Icon name="card" active={false} />
            <RowText label="Payment Methods" desc="Cards and bank accounts on file." />
          </button>
        </form>
        <Link href="/my-courts/settings" className={rowClass}>
          <Icon name="settings" active={false} />
          <RowText label="Account Settings" desc="Your login and account details." />
        </Link>
        {showAdminSwitch && (
          <Link href="/os" className={rowClass}>
            <Icon name="account" active={false} />
            <RowText label="Switch to Admin" desc="Open Courts OS." />
          </Link>
        )}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gray-mid bg-white font-sport text-sm font-bold uppercase tracking-wide text-gray-dark transition-colors hover:border-orange hover:text-orange"
        >
          <Icon name="signout" active={false} />
          Sign Out
        </button>
      </form>
    </div>
  );
}
