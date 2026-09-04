import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export default async function MyCourtsLayout({ children }: { children: React.ReactNode }) {
  const guardian = await getCurrentGuardian();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <span className="font-bold">The Courts</span>
          <Link href="/my-courts" className="text-neutral-600 hover:text-black">
            Family
          </Link>
          <Link href="/my-courts/schedule" className="text-neutral-600 hover:text-black">
            Schedule
          </Link>
          <Link href="/my-courts/bookings" className="text-neutral-600 hover:text-black">
            Book
          </Link>
          <Link href="/my-courts/waivers" className="text-neutral-600 hover:text-black">
            Waivers
          </Link>
          <Link href="/my-courts/memberships" className="text-neutral-600 hover:text-black">
            Membership
          </Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-600">{guardian.name}</span>
          <form action={logout}>
            <button type="submit" className="font-medium underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  );
}
