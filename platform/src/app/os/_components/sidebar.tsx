"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/os/nav";

// The shell's navigation. Client-side only for the "is this route selected"
// highlight and the mobile drawer — WHICH items exist is decided on the server
// from the actor's capabilities and passed in, so nothing here is a security
// boundary. A link this component never renders is still refused by the page.

function isSelected(pathname: string, href: string) {
  if (href === "/os") return pathname === "/os";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const selected = isSelected(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={selected ? "page" : undefined}
              className={`os-heading flex min-h-11 items-center rounded-lg px-3 text-[13px] uppercase tracking-wide transition-colors ${
                selected
                  ? "bg-orange text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({
  primary,
  more,
  actorName,
  actorRole,
  scopeNote,
  signOut,
}: {
  primary: NavItem[];
  more: NavItem[];
  actorName: string;
  actorRole: string;
  scopeNote: string | null;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the drawer — keyboard users shouldn't be trapped in it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <Link href="/os" className="flex items-center gap-2.5 px-3 py-4">
      <Image
        src="/brand/logo-horizontal-full-white.png"
        alt="The Courts"
        width={112}
        height={48}
        priority
      />
      <span className="os-eyebrow rounded bg-orange px-1.5 py-1 text-white">OS</span>
    </Link>
  );

  const body = (
    <>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavList items={primary} pathname={pathname} />
        {more.length > 0 ? (
          <>
            <p className="os-eyebrow px-3 pb-2 pt-5 text-white/40">More</p>
            <NavList items={more} pathname={pathname} />
          </>
        ) : null}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="os-heading text-xs uppercase tracking-wide text-white">{actorName}</p>
        <p className="os-eyebrow mt-1 text-white/50">{actorRole}</p>
        {scopeNote ? <p className="mt-1 text-[11px] text-white/50">{scopeNote}</p> : null}
        <div className="mt-2">{signOut}</div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: persistent left sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-near-black lg:flex">
        {brand}
        {body}
      </aside>

      {/* Mobile/tablet: header + drawer. Deliberately NOT bottom nav — an
          operations system this size doesn't fit five tabs honestly. */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-near-black px-3 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="os-mobile-nav"
          className="os-heading mr-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs uppercase tracking-wide text-white hover:bg-white/10"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>

      {open ? (
        <div
          id="os-mobile-nav"
          className="fixed inset-x-0 bottom-0 top-[72px] z-20 flex flex-col bg-near-black lg:hidden"
        >
          {body}
        </div>
      ) : null}
    </>
  );
}
