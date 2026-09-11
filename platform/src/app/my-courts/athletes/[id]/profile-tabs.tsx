"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four tabs, no generic "More" junk drawer.
//
// Each tab is one kind of thing: Player Card is who this athlete is and how
// to coach them, Progress is coach-written development notes, Family +
// Safety is household/emergency logistics, and Waivers + Permissions is the
// consent/legal record. Nothing here is a page waiting for a use — Schedule
// and Programs join once there's something live to book or enroll in.

const TABS = [
  { slug: "", label: "Player Card" },
  { slug: "progress", label: "Progress" },
  { slug: "family-safety", label: "Family + Safety" },
  { slug: "waivers", label: "Waivers + Permissions" },
];

export default function ProfileTabs({ athleteId }: { athleteId: string }) {
  const pathname = usePathname();
  const base = `/my-courts/athletes/${athleteId}`;

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b border-gray-mid px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = tab.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                className={`flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 font-sport text-[12.5px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? "border-orange text-orange"
                    : "border-transparent text-gray-dark hover:text-near-black"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
