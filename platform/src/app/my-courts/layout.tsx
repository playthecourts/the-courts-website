import Image from "next/image";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { familyCrewInitials, familyCrewName } from "@/lib/family";
import { AccountMenu } from "./account-menu";
import NavLink, { SignOutNavItem } from "./nav-link";

const NAV_ITEMS = [
  { href: "/my-courts", label: "Home", icon: "home" as const },
  { href: "/my-courts/schedule", label: "Schedule", icon: "schedule" as const },
  { href: "/my-courts/explore", label: "Explore", icon: "explore" as const },
  { href: "/my-courts/athletes", label: "My Athletes", icon: "athletes" as const },
  { href: "/my-courts/memberships", label: "Membership", icon: "training" as const },
  { href: "/my-courts/league", label: "Fall League", icon: "league" as const },
  { href: "/my-courts/payments", label: "Payments", icon: "payments" as const },
  { href: "/my-courts/waivers", label: "Waivers + Permissions", icon: "waivers" as const },
];

export default async function MyCourtsLayout({ children }: { children: React.ReactNode }) {
  const guardian = await getCurrentGuardian();
  const familyName = guardian.families[0]?.family.name ?? null;
  const crewName = familyCrewName(familyName);
  const initials = familyCrewInitials(familyName);

  return (
    <div className="flex min-h-screen flex-col bg-gray-light md:flex-row">
      {/* Desktop sidebar — sticky + its own height/scroll, so it stays
          pinned to the viewport (account widget included) instead of
          stretching to match a tall <main> and getting pushed off-screen. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-mid bg-white md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">
        <div className="flex items-center gap-3 px-6 py-6">
          <Link href="/my-courts">
            <Image
              src="/brand/logo-horizontal-full-color.png"
              alt="The Courts"
              width={140}
              height={60}
              priority
            />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} variant="sidebar">
              {item.label}
            </NavLink>
          ))}
          <SignOutNavItem variant="sidebar" />
        </nav>
        <div className="border-t border-gray-mid px-4 py-3">
          <AccountMenu crewName={crewName} initials={initials} variant="sidebar" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-gray-mid bg-white px-4 py-3 md:hidden">
        <Link href="/my-courts">
          <Image
            src="/brand/logo-horizontal-full-color.png"
            alt="The Courts"
            width={112}
            height={48}
            priority
          />
        </Link>
        <AccountMenu crewName={crewName} initials={initials} variant="mobile" />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-10 md:px-10 md:pb-10 md:pt-14">
        {children}
      </main>

      {/* Mobile bottom nav — scrolls horizontally since it now holds every
          destination that used to live behind "More" */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-gray-mid bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} variant="bottom">
            {item.label}
          </NavLink>
        ))}
        <SignOutNavItem variant="bottom" />
      </nav>
    </div>
  );
}
