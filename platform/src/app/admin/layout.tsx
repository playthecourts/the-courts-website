import { getCurrentStaff } from "@/lib/admin-dal";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "@/app/os/_components/sidebar";
import { ROLE_LABELS } from "@/lib/os/permissions";

// Admin navigation lives in the same left side panel as The Courts OS
// (desktop: fixed sidebar; phone/tablet: header with a Menu drawer).
const ADMIN_NAV = [
  { label: "Admin Home", href: "/admin" },
  { label: "Families", href: "/admin/families" },
  { label: "Athletes", href: "/admin/athletes" },
  { label: "Programs", href: "/admin/programs" },
  { label: "Schedule", href: "/admin/schedule" },
  { label: "Memberships", href: "/admin/memberships" },
  { label: "Resources", href: "/admin/resources" },
  { label: "Waivers", href: "/admin/waivers" },
];

const MORE_NAV = [{ label: "Open The Courts OS", href: "/os" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();

  return (
    <div className="os min-h-screen bg-gray-light">
      <Sidebar
        primary={ADMIN_NAV}
        more={MORE_NAV}
        homeHref="/admin"
        badge="Admin"
        moreLabel="Switch"
        actorName={staff.name}
        actorRole={ROLE_LABELS[staff.role] ?? staff.role}
        scopeNote={null}
        signOut={
          <form action={logout}>
            <button
              type="submit"
              className="os-eyebrow text-white/60 underline underline-offset-2 hover:text-white"
            >
              Sign out
            </button>
          </form>
        }
      />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
