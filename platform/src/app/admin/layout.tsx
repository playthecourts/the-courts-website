import Image from "next/image";
import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { logout } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();

  return (
    <div className="min-h-screen bg-gray-light">
      <header className="flex items-center justify-between border-b border-gray-mid bg-black px-6 py-3">
        <nav className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/brand/logo-horizontal-full-white.png"
              alt="The Courts"
              width={160}
              height={44}
              className="h-8 w-auto"
              priority
            />
            <span className="font-sport text-[10px] font-bold uppercase tracking-widest text-orange">
              Admin
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-sport text-xs font-bold uppercase tracking-wide">
            <Link href="/admin/families" className="text-white/70 hover:text-orange">
              Families
            </Link>
            <Link href="/admin/athletes" className="text-white/70 hover:text-orange">
              Athletes
            </Link>
            <Link href="/admin/programs" className="text-white/70 hover:text-orange">
              Programs
            </Link>
            <Link href="/admin/schedule" className="text-white/70 hover:text-orange">
              Schedule
            </Link>
            <Link href="/admin/memberships" className="text-white/70 hover:text-orange">
              Memberships
            </Link>
            <Link href="/admin/resources" className="text-white/70 hover:text-orange">
              Resources
            </Link>
            <Link href="/admin/waivers" className="text-white/70 hover:text-orange">
              Waivers
            </Link>
          </div>
        </nav>
        <div className="flex items-center gap-4 font-body text-sm">
          <span className="text-white/70">
            {staff.name} · {staff.role}
          </span>
          <form action={logout}>
            <button type="submit" className="font-medium text-white underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
