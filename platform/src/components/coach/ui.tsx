import Link from "next/link";
import type { Route } from "next";

// Shared presentational pieces for the Coach App. Server components — no
// client JS — so they cost nothing on a phone with two bars of signal.

/** Small condensed uppercase label. The Courts' eyebrow/stat-tag voice. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-sport text-[11px] font-bold uppercase tracking-[0.14em] ${className}`}>
      {children}
    </p>
  );
}

/** Page title. Archivo Black, tight, loud — the display voice. */
export function PageTitle({
  children,
  eyebrow,
  sub,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  sub?: string;
}) {
  return (
    <div className="mb-5">
      {eyebrow && <Eyebrow className="mb-1 text-orange">{eyebrow}</Eyebrow>}
      <h1 className="font-display text-[26px] leading-[1.05] font-black uppercase tracking-tight text-near-black">
        {children}
      </h1>
      {sub && <p className="mt-1.5 font-body text-sm text-gray-dark">{sub}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-mid bg-white ${className}`}>{children}</div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
      {children}
    </h2>
  );
}

/**
 * Status pill. `tone` carries meaning, but the label always says the thing in
 * words too — color is never the only signal (accessibility bar).
 */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "alert" | "accent";
}) {
  const tones = {
    neutral: "bg-warm-stone text-gray-dark",
    ok: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border border-amber-300",
    alert: "bg-red-50 text-red-800 border border-red-300",
    accent: "bg-orange text-white",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-sport text-[10.5px] font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Primary action. Full-width by default — thumb-reachable, one-handed. */
export function ActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: Route;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-orange text-white hover:bg-orange-hover"
      : "border border-gray-mid bg-white text-near-black hover:border-near-black";
  return (
    <Link
      href={href}
      className={`flex min-h-[48px] w-full items-center justify-center rounded-lg px-4 font-heading text-sm font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * Empty state. Courts personality is fine here — nothing operational is at
 * stake when there's nothing to show.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-5 py-10 text-center">
      <p className="font-display text-lg font-black uppercase tracking-tight text-near-black">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-gray-dark">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

/** Round initial chip used on roster/athlete rows. */
export function Avatar({ initials: text }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-stone font-sport text-sm font-bold text-charcoal"
    >
      {text}
    </span>
  );
}

/** A labelled number, for the head-coach/admin dashboards. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "attention";
}) {
  return (
    <div className="rounded-lg border border-gray-mid bg-white px-3 py-2.5">
      <p className="font-sport text-[10px] font-bold uppercase tracking-[0.12em] text-gray-dark">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-black leading-tight ${
          tone === "attention" && value !== 0 ? "text-orange" : "text-near-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BackLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex min-h-[36px] items-center gap-1 font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}
