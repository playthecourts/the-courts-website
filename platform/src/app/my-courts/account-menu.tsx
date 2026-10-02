"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { openBillingPortal } from "./actions";

// The family account menu — represents the household, not the individual
// parent who happens to be signed in. Lives bottom-left on desktop (sidebar
// variant, opens upward). On phones the header avatar is just a shortcut to
// the Account tab (/my-courts/more), which already lists every one of these
// — so a phone has exactly one Sign Out, not two.

const itemClass =
  "flex min-h-[44px] w-full items-center px-4 text-left font-body text-sm text-near-black transition-colors hover:bg-orange/10 hover:text-orange";

export function AccountMenu({
  crewName,
  initials,
  variant = "sidebar",
  showAdminSwitch = false,
}: {
  crewName: string;
  initials: string;
  variant?: "sidebar" | "mobile";
  showAdminSwitch?: boolean;
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
        <Link href="/my-courts/more" aria-label="Account" className="flex h-11 w-11 items-center justify-center">
          {avatar}
        </Link>
      )}

      {open && variant === "sidebar" && (
        <div
          className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-xl border border-gray-mid bg-white py-1.5 shadow-lg"
        >
          <Link href="/my-courts/family" onClick={() => setOpen(false)} className={itemClass}>
            Family Profile
          </Link>
          {/* Stripe billing portal — same place Membership's "Manage
              Billing" goes. No Stripe customer yet → Payments. */}
          <form action={openBillingPortal}>
            <button type="submit" className={itemClass}>
              Payment Methods
            </button>
          </form>
          <Link href="/my-courts/settings" onClick={() => setOpen(false)} className={itemClass}>
            Account Settings
          </Link>
          {showAdminSwitch && (
            <>
              <div className="my-1 border-t border-gray-mid" />
              <Link
                href="/os"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center px-4 font-body text-sm text-orange transition-colors hover:bg-orange/10"
              >
                Switch to Admin →
              </Link>
            </>
          )}
          <div className="my-1 border-t border-gray-mid" />
          <form action={logout}>
            <button type="submit" className={itemClass}>
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
