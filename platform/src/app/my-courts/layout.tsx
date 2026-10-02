import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentGuardian, hasActiveStaffAccount } from "@/lib/dal";
import { familyCrewInitials, familyCrewName } from "@/lib/family";
import { AccountMenu } from "./account-menu";
import NavLink, { type IconName } from "./nav-link";

// The Parent App ("My Courts") as an installable app — its own manifest and
// identity, scoped to /my-courts so "Add to Home Screen" installs The Courts
// family app rather than the Coach App (see coach/(app)/layout.tsx, which this
// mirrors).
export const metadata: Metadata = {
  applicationName: "The Courts",
  manifest: "/my-courts/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "The Courts",
    statusBarStyle: "default",
  },
  // Metadata merges shallowly — `icons` here replaces the root layout's whole
  // icons object, so the favicons are repeated alongside the app icon.
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/icons/parent-apple-180.png",
  },
  other: { "mobile-web-app-capable": "yes" },
};

// viewport-fit=cover is what makes env(safe-area-inset-*) report real values,
// so the bottom bar can clear the iPhone home indicator.
export const viewport: Viewport = {
  themeColor: "#171717",
  viewportFit: "cover",
};

// Desktop/tablet sidebar: every named destination, in the order a parent
// thinks about them. No "More" junk drawer — Payments and Waivers get real
// slots; profile-type things (Family Profile, Payment Methods, Account
// Settings, Sign Out) live in the account menu at the bottom of the sidebar.
//
// Camps & Events isn't its own slot: it's a way to Book, so Explore links to
// it and the Book item stays lit while you're there.
const SIDEBAR_ITEMS: { href: string; label: string; icon: IconName; match?: string[] }[] = [
  { href: "/my-courts", label: "Home", icon: "home" },
  { href: "/my-courts/explore", label: "Book", icon: "book", match: ["/my-courts/camps"] },
  { href: "/my-courts/schedule", label: "Schedule", icon: "schedule" },
  { href: "/my-courts/athletes", label: "My Athletes", icon: "athletes" },
  { href: "/my-courts/memberships", label: "Membership", icon: "membership" },
  { href: "/my-courts/league", label: "Fall League", icon: "league" },
  { href: "/my-courts/payments", label: "Payments", icon: "payments" },
  { href: "/my-courts/waivers", label: "Waivers + Permissions", icon: "waivers" },
];

// Phone bottom bar: exactly five tabs, no sideways scroll. Everything else
// lives on Account (/my-courts/more — the path is kept so old links work).
const BOTTOM_ITEMS: { href: string; label: string; icon: IconName; match?: string[] }[] = [
  { href: "/my-courts", label: "Home", icon: "home" },
  { href: "/my-courts/explore", label: "Book", icon: "book", match: ["/my-courts/camps"] },
  { href: "/my-courts/schedule", label: "Schedule", icon: "schedule" },
  { href: "/my-courts/athletes", label: "Athletes", icon: "athletes" },
  {
    href: "/my-courts/more",
    label: "Account",
    icon: "account",
    match: [
      "/my-courts/memberships",
      "/my-courts/league",
      "/my-courts/payments",
      "/my-courts/waivers",
      "/my-courts/settings",
    ],
  },
];

export default async function MyCourtsLayout({ children }: { children: React.ReactNode }) {
  const guardian = await getCurrentGuardian();
  const familyName = guardian.families[0]?.family.name ?? null;
  const crewName = familyCrewName(familyName);
  const initials = familyCrewInitials(familyName);
  const showAdminSwitch = await hasActiveStaffAccount();

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
          {SIDEBAR_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} match={item.match} variant="sidebar">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-mid px-4 py-3">
          <AccountMenu crewName={crewName} initials={initials} variant="sidebar" showAdminSwitch={showAdminSwitch} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-gray-mid bg-white px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
        <Link href="/my-courts">
          <Image
            src="/brand/logo-horizontal-full-color.png"
            alt="The Courts"
            width={112}
            height={48}
            priority
          />
        </Link>
        <AccountMenu crewName={crewName} initials={initials} variant="mobile" showAdminSwitch={showAdminSwitch} />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-10 md:px-10 md:pb-10 md:pt-14">
        {children}
      </main>

      {/* Mobile bottom nav — five fixed-width tabs, padded clear of the
          iPhone home indicator. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-mid bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} match={item.match} variant="bottom">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
