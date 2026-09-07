"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "schedule" | "explore" | "athletes" | "more";

function Icon({ name, active }: { name: IconName; active: boolean }) {
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
    case "more":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="5" cy="12" r="1.4" fill={stroke} stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill={stroke} stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill={stroke} stroke="none" />
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
        className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1"
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
