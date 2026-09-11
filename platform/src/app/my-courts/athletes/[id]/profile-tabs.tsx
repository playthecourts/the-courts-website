"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Four tabs, and no more.
//
// The brief for this profile was "help us know your kid", not "complete another
// registration packet", and eight tabs across a phone is what the second one
// looks like. Player Card, Progress and Schedule are what a parent opens
// repeatedly; everything administrative — about, coaching, safety, guardians,
// pickup, privacy — lives one level down under More, where it is findable
// without being in the way. Programs lives here too until there's something
// live to enroll in.

const TABS = [
  { slug: "", label: "Player Card" },
  { slug: "progress", label: "Progress" },
  { slug: "schedule", label: "Schedule" },
  { slug: "more", label: "More" },
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
