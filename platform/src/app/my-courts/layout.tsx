import Image from "next/image";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { logout } from "@/app/actions/auth";
import NavLink from "./nav-link";

const NAV_ITEMS = [
  { href: "/my-courts", label: "Home", icon: "home" as const },
  { href: "/my-courts/schedule", label: "Schedule", icon: "schedule" as const },
  { href: "/my-courts/explore", label: "Explore", icon: "explore" as const },
  { href: "/my-courts/athletes", label: "My Athletes", icon: "athletes" as const },
  { href: "/my-courts/more", label: "More", icon: "more" as const },
];

export default async function MyCourtsLayout({ children }: { children: React.ReactNode }) {
  const guardian = await getCurrentGuardian();
  const firstName = guardian.name.split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col bg-gray-light md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-mid bg-white md:flex">
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
        </nav>
        <div className="flex items-center justify-between border-t border-gray-mid px-6 py-4">
          <span className="truncate font-body text-sm text-gray-dark">{firstName}</span>
          <form action={logout}>
            <button
              type="submit"
              className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
            >
              Sign Out
            </button>
          </form>
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
        <form action={logout}>
          <button
            type="submit"
            className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark"
          >
            Sign Out
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10 md:pt-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-mid bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} variant="bottom">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
