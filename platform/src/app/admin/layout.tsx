import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { logout } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <nav className="flex items-center gap-6 text-sm font-medium">
          <span className="font-bold">The Courts Admin</span>
          <Link href="/admin/families" className="text-neutral-600 hover:text-black">
            Families
          </Link>
          <Link href="/admin/athletes" className="text-neutral-600 hover:text-black">
            Athletes
          </Link>
          <Link href="/admin/programs" className="text-neutral-600 hover:text-black">
            Programs
          </Link>
          <Link href="/admin/schedule" className="text-neutral-600 hover:text-black">
            Schedule
          </Link>
          <Link href="/admin/memberships" className="text-neutral-600 hover:text-black">
            Memberships
          </Link>
          <Link href="/admin/resources" className="text-neutral-600 hover:text-black">
            Resources
          </Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-600">
            {staff.name} · {staff.role}
          </span>
          <form action={logout}>
            <button type="submit" className="font-medium underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
