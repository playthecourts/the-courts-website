"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

type IconName =
  | "home"
  | "schedule"
  | "explore"
  | "athletes"
  | "training"
  | "league"
  | "payments"
  | "waivers"
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
    case "schedule":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      );
    case "explore":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="m14.5 9.5-2 5-3 1.5 2-5 3-1.5Z" />
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
    case "training":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M9 3V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V3" />
          <path d="M9 12.5l2 2 4-4.5" />
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
    case "payments":
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

export default function NavLink({
  href,
  icon,
  children,
  variant,
}: {
  href: string;
  icon: IconName;
  children: React.ReactNode;
  variant: "bottom" | "sidebar";
}) {
  const pathname = usePathname();
  const active = href === "/my-courts" ? pathname === href : pathname.startsWith(href);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        className="flex min-h-[56px] w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 py-1"
      >
        <Icon name={icon} active={active} />
        <span
          className={`font-sport text-[10.5px] font-bold uppercase tracking-wide ${
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
      className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 font-sport text-sm font-bold uppercase tracking-wide ${
        active ? "bg-orange/10 text-orange" : "text-gray-dark hover:bg-gray-light"
      }`}
    >
      <Icon name={icon} active={active} />
      {children}
    </Link>
  );
}

export function SignOutNavItem({ variant }: { variant: "bottom" | "sidebar" }) {
  if (variant === "bottom") {
    return (
      <form action={logout} className="flex min-h-[56px] w-[76px] shrink-0">
        <button
          type="submit"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
        >
          <Icon name="signout" active={false} />
          <span className="font-sport text-[10.5px] font-bold uppercase tracking-wide text-gray-dark">
            Sign Out
          </span>
        </button>
      </form>
    );
  }

  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 font-sport text-sm font-bold uppercase tracking-wide text-gray-dark hover:bg-gray-light"
      >
        <Icon name="signout" active={false} />
        Sign Out
      </button>
    </form>
  );
}
