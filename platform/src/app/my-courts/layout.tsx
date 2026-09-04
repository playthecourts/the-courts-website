import Image from "next/image";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export default async function MyCourtsLayout({ children }: { children: React.ReactNode }) {
  const guardian = await getCurrentGuardian();

  return (
    <div className="min-h-screen bg-gray-light">
      <header className="flex items-center justify-between border-b border-gray-mid bg-white px-6 py-3">
        <nav className="flex items-center gap-6">
          <Link href="/my-courts">
            <Image
              src="/brand/logo-horizontal-full-color.png"
              alt="The Courts"
              width={160}
              height={44}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-5 font-sport text-xs font-bold uppercase tracking-wide">
            <Link href="/my-courts" className="text-gray-dark hover:text-orange">
              Family
            </Link>
            <Link href="/my-courts/schedule" className="text-gray-dark hover:text-orange">
              Schedule
            </Link>
            <Link href="/my-courts/bookings" className="text-gray-dark hover:text-orange">
              Book
            </Link>
            <Link href="/my-courts/waivers" className="text-gray-dark hover:text-orange">
              Waivers
            </Link>
            <Link href="/my-courts/memberships" className="text-gray-dark hover:text-orange">
              Membership
            </Link>
          </div>
        </nav>
        <div className="flex items-center gap-4 font-body text-sm">
          <span className="text-gray-dark">{guardian.name}</span>
          <form action={logout}>
            <button type="submit" className="font-medium text-black underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  );
}
