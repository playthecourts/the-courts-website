"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One icon per meaning — never shared between two destinations, so the
// picture alone tells a parent where a tap goes.
export type IconName =
  | "home"
  | "book" // find + book something new (Explore)
  | "schedule" // what's already on the calendar
  | "athletes" // My Athletes — a jersey
  | "family" // Family Profile — grown-up + kid
  | "membership"
  | "league"
  | "camps"
  | "payments" // receipts / what's owed
  | "card" // Payment Methods
  | "waivers"
  | "settings"
  | "account"
  | "messages"
  | "signout";

export function Icon({ name, active }: { name: IconName; active: boolean }) {
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
    case "home":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
        </svg>
      );
    case "book":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path d="M12 13v5M9.5 15.5h5" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "athletes":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 3c0 2 1.3 3.5 3 3.5S15 5 15 3l2.5.5c0 3 1 5 2.5 6V21H4V9.5c1.5-1 2.5-3 2.5-6L9 3Z" />
          <path d="M10 12.5h4M10 15.5h4" />
        </svg>
      );
    case "family":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
          <circle cx="17.5" cy="10" r="2" />
          <path d="M15.8 15.3c2.2.2 3.7 2 3.7 4.7" />
        </svg>
      );
    case "membership":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="11" r="2" />
          <path d="M5.5 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2" />
          <path d="M14 10h4M14 13.5h3" />
        </svg>
      );
    case "league":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
          <path d="M12 12v3M9 19h6M10.5 15h3l.5 4h-4l.5-4Z" />
        </svg>
      );
    case "camps":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 20L12 5l9 15H3Z" />
          <path d="M9.5 11.5L12 5l2.5 6.5" />
          <path d="M12 5v2" />
        </svg>
      );
    case "payments":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.2V3Z" />
          <path d="M9 8h6M9 11.5h6M9 15h3.5" />
        </svg>
      );
    case "card":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10.5h18" />
          <path d="M7 15h4" />
        </svg>
      );
    case "waivers":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 3h7l4 4v14H7Z" />
          <path d="M14 3v4h4" />
          <path d="M9.5 13.5l2 2 4-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
        </svg>
      );
    case "account":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="10" r="3" />
          <path d="M6.5 18.2c1.2-2 3.1-3 5.5-3s4.3 1 5.5 3" />
        </svg>
      );
    case "messages":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H8l-4 4V6.5a1 1 0 0 1 1-1Z" />
          <path d="M8 9.5h9M8 13h6" />
        </svg>
      );
    case "signout":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
          <path d="M15 16l4-4-4-4" />
          <path d="M19 12H9" />
        </svg>
      );
  }
}

function isActive(pathname: string, href: string, match: string[] = []) {
  if (href === "/my-courts") return pathname === href;
  return [href, ...match].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function NavLink({
  href,
  icon,
  children,
  variant,
  match,
}: {
  href: string;
  icon: IconName;
  children: React.ReactNode;
  variant: "bottom" | "sidebar";
  /// Extra path prefixes that should light this item up — e.g. Camps under
  /// Book, or every account page under the phone's Account tab.
  match?: string[];
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href, match);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1"
      >
        <Icon name={icon} active={active} />
        <span
          className={`font-sport text-[12px] font-bold uppercase tracking-wide ${
            active ? "text-orange" : "text-gray-dark"
          }`}
        >
          {children}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 font-sport text-sm font-bold uppercase tracking-wide ${
        active ? "bg-orange/10 text-orange" : "text-gray-dark hover:bg-gray-light"
      }`}
    >
      <Icon name={icon} active={active} />
      {children}
    </Link>
  );
}
