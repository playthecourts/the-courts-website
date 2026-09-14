"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

// The family account switcher — represents the household, not the
// individual parent who happens to be signed in. Lives bottom-left on
// desktop (sidebar variant, opens upward) and behind a small avatar in the
// mobile header (mobile variant, opens downward).

const MENU_ITEMS = [
  { href: "/my-courts/family", label: "Family Profile" },
  { href: "/my-courts/athletes", label: "My Athletes" },
  { href: "/my-courts/memberships", label: "Membership" },
  { href: "/my-courts/messages", label: "Messages" },
  { href: "/my-courts/payments", label: "Payment Methods" },
  { href: "/my-courts/settings", label: "Settings" },
];

export function AccountMenu({
  crewName,
  initials,
  variant = "sidebar",
}: {
  crewName: string;
  initials: string;
  variant?: "sidebar" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const avatar = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-near-black font-display text-[13px] font-black text-white">
      {initials}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-light"
        >
          {avatar}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-heading text-[13.5px] font-bold text-near-black">
              {crewName}
            </span>
            <span className="block font-body text-[11.5px] text-gray-dark">Family Account</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Account menu"
          className="block"
        >
          {avatar}
        </button>
      )}

      {open && (
        <div
          className={`absolute z-30 w-56 rounded-xl border border-gray-mid bg-white py-1.5 shadow-lg ${
            variant === "sidebar" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          {variant === "mobile" && (
            <div className="border-b border-gray-mid px-4 py-2.5">
              <p className="truncate font-heading text-[13.5px] font-bold text-near-black">{crewName}</p>
              <p className="font-body text-[11.5px] text-gray-dark">Family Account</p>
            </div>
          )}
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 font-body text-sm text-near-black transition-colors hover:bg-orange/10 hover:text-orange"
            >
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-gray-mid" />
          <form action={logout}>
            <button
              type="submit"
              className="block w-full px-4 py-2 text-left font-body text-sm text-near-black transition-colors hover:bg-orange/10 hover:text-orange"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
