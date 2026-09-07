import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, isLeadership } from "@/lib/coach-dal";
import CoachNav, { type CoachNavItem } from "./coach-nav";
import RegisterServiceWorker from "./register-sw";
import OfflineBanner from "./offline-banner";

export const metadata: Metadata = {
  title: "The Courts Coach",
  applicationName: "The Courts Coach",
  manifest: "/coach/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "The Courts Coach",
    statusBarStyle: "black-translucent",
  },
  themeColor: "#1A1A1A",
  other: { "mobile-web-app-capable": "yes" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  head_coach: "Head Coach",
  coach: "Coach",
};

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentCoach();

  // The Teams tab adapts: a coach with no league team assignments gets
  // "Groups" (their training groups) rather than a tab that's always empty.
  const teamCount = await prisma.teamCoach.count({ where: { staffUserId: actor.id } });
  const showsTeams = teamCount > 0 || isLeadership(actor);

  const navItems: CoachNavItem[] = [
    { href: "/coach", label: "Today", icon: "today" },
    { href: "/coach/schedule", label: "Schedule", icon: "schedule" },
    { href: "/coach/athletes", label: "Athletes", icon: "athletes" },
    {
      href: "/coach/teams",
      label: showsTeams ? "Teams" : "Groups",
      icon: showsTeams ? "teams" : "groups",
    },
    { href: "/coach/more", label: "More", icon: "more" },
  ];

  const roleLabel = ROLE_LABELS[actor.role] ?? "Coach";
  const sportSuffix = actor.isHeadCoach && actor.scopedSports.length ? ` · ${actor.scopedSports.join(" & ")}` : "";

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <RegisterServiceWorker />

      {/* Top bar. Deliberately dark and compact — it's a wayfinding strip,
          not a dashboard header, and it gives back vertical space on a phone. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/40 bg-charcoal px-4 py-2.5">
        <Link href="/coach" className="flex items-center gap-2.5" aria-label="The Courts Coach — Today">
          <Image
            src="/brand/logo-horizontal-full-white.png"
            alt="The Courts"
            width={104}
            height={45}
            priority
            className="h-7 w-auto"
          />
          <span className="font-sport text-[10px] font-bold uppercase tracking-[0.18em] text-orange">
            Coach
          </span>
        </Link>
        <Link
          href="/coach/more"
          className="flex min-h-[36px] items-center rounded-full border border-white/15 px-3 font-sport text-[10px] font-bold uppercase tracking-wider text-white/70 hover:border-orange hover:text-orange"
        >
          {roleLabel}
          {sportSuffix}
        </Link>
      </header>

      <OfflineBanner />

      {/* pb-28 clears the fixed bottom nav plus the iOS home indicator. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4 md:px-6 md:pt-6">
        {children}
      </main>

      <CoachNav items={navItems} />
    </div>
  );
}
