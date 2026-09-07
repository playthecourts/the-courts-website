"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CoachNavIcon = "today" | "schedule" | "athletes" | "teams" | "groups" | "more";
export type CoachNavItem = { href: string; label: string; icon: CoachNavIcon };

function Icon({ name, active }: { name: CoachNavIcon; active: boolean }) {
  const stroke = active ? "var(--color-orange)" : "var(--color-gray-dark)";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "today":
      // A whistle — "today's court", not a generic home glyph.
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="14" r="5.5" />
          <path d="M14 11.5h6.5a1 1 0 0 0 1-1V8.5a1 1 0 0 0-1-1H12a2.5 2.5 0 0 0-2.5 2.5v.6" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      );
    case "athletes":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
          <circle cx="17.5" cy="8.5" r="2.3" />
          <path d="M15.7 14.7c2.4.3 4 2.3 4 5.3" />
        </svg>
      );
    case "teams":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 3.5 5 6.2v5c0 4.2 2.9 7.6 7 8.8 4.1-1.2 7-4.6 7-8.8v-5L12 3.5Z" />
          <path d="M9.5 12.2l1.8 1.8 3.4-3.6" />
        </svg>
      );
    case "groups":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v17M3.5 12h17" />
        </svg>
      );
    case "more":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="5" cy="12" r="1.5" fill={stroke} stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill={stroke} stroke="none" />
          <circle cx="19" cy="12" r="1.5" fill={stroke} stroke="none" />
        </svg>
      );
  }
}

export default function CoachNav({ items }: { items: CoachNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Coach navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-mid bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {items.map((item) => {
        const active =
          item.href === "/coach" ? pathname === "/coach" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // min-h-[60px] keeps every tab comfortably past the 44px target
            // even with the label underneath.
            className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
          >
            {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-orange" />}
            <Icon name={item.icon} active={active} />
            <span
              className={`font-sport text-[10.5px] font-bold uppercase tracking-wide ${
                active ? "text-orange" : "text-gray-dark"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
