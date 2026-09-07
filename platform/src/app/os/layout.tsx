import type { Metadata } from "next";
import { getOsActor } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { ROLE_LABELS } from "@/lib/os/permissions";
import { MORE_NAV, PRIMARY_NAV } from "@/lib/os/nav";
import { logout } from "@/app/actions/auth";
import { Sidebar } from "./_components/sidebar";
import { CommandPalette } from "./_components/command-palette";

export const metadata: Metadata = {
  title: "The Courts OS",
  description: "Internal operating system for The Courts.",
  robots: { index: false, follow: false },
};

export default async function OsLayout({ children }: LayoutProps<"/os">) {
  // The real gate. Everything below this line has an authenticated, active
  // staff actor — but each page still re-checks its own capability, because a
  // rendered layout is not authorization for what it wraps.
  const actor = await getOsActor();

  const primary = PRIMARY_NAV.filter((i) => can(actor, i.capability));
  const more = MORE_NAV.filter((i) => can(actor, i.capability));

  const scopeNote =
    actor.role === "head_coach" && actor.sports.length > 0
      ? `Scoped to ${actor.sports.join(" + ")}`
      : null;

  return (
    <div className="os min-h-screen bg-warm-white">
      <Sidebar
        primary={primary}
        more={more}
        actorName={actor.name}
        actorRole={ROLE_LABELS[actor.role]}
        scopeNote={scopeNote}
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
      {can(actor, "families.view") || can(actor, "programs.view") ? <CommandPalette /> : null}
      <div className="lg:pl-60">
        <main id="os-main" className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
