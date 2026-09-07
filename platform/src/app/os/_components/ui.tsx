import Link from "next/link";
import type { ReactNode } from "react";

// Shared Courts OS primitives. Everything visual that repeats lives here, so a
// status pill means the same thing and looks the same on every screen.

/* -------------------------------------------------------------------------
   Status
   Tone carries meaning; the LABEL always carries it too. No status in Courts
   OS is communicated by colour alone — a pill is text first, tinted second.
   ------------------------------------------------------------------------- */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
  brand: "bg-orange/10 text-orange-hover",
};

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`os-eyebrow inline-flex items-center gap-1 rounded-full px-2 py-1 ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export const REGISTRATION_TONE: Record<string, Tone> = {
  started: "neutral",
  incomplete: "warning",
  registered: "success",
  waitlisted: "info",
  cancelled: "neutral",
  admin_review: "danger",
};

export const PAYMENT_TONE: Record<string, Tone> = {
  none: "neutral",
  due: "warning",
  pending: "info",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
};

export const PROGRAM_STATUS_TONE: Record<string, Tone> = {
  draft: "neutral",
  published: "success",
  closed: "warning",
  completed: "info",
  cancelled: "danger",
  archived: "neutral",
};

/* ------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="os-eyebrow mb-2 text-orange">{eyebrow}</p> : null}
        <h1 className="os-display text-3xl leading-tight text-near-black sm:text-4xl">{title}</h1>
        {subtitle ? <div className="mt-2 text-sm text-gray-dark">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <As className={`rounded-xl border border-gray-mid bg-white ${className}`}>{children}</As>
  );
}

export function CardHeader({
  title,
  action,
  count,
}: {
  title: string;
  action?: ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-mid px-4 py-3">
      <h2 className="os-eyebrow text-gray-dark">
        {title}
        {count !== undefined ? <span className="ml-2 text-neutral">{count}</span> : null}
      </h2>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Buttons. `min-h-11` = 44px, the accessible touch target the spec asks for,
   applied on every size so a "small" button is still tappable on a tablet at
   the front desk.
   ------------------------------------------------------------------------- */

const BTN_BASE =
  "os-heading inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const BTN = {
  primary: `${BTN_BASE} bg-orange text-white hover:bg-orange-hover`,
  secondary: `${BTN_BASE} border border-gray-mid bg-white text-near-black hover:border-near-black`,
  ghost: `${BTN_BASE} text-gray-dark hover:bg-warm-stone`,
  danger: `${BTN_BASE} border border-danger bg-white text-danger hover:bg-danger-bg`,
};

export function ButtonLink({
  href,
  variant = "secondary",
  children,
}: {
  href: string;
  variant?: keyof typeof BTN;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={BTN[variant]}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------
   Empty states. Courts personality, but the second line always says plainly
   what is (or isn't) there — the voice never costs the reader clarity.
   ------------------------------------------------------------------------- */

export function EmptyState({
  headline,
  detail,
  action,
}: {
  headline: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="os-display text-xl text-near-black">{headline}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-dark">{detail}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Metric tile. Used across Today and Reports.
   ------------------------------------------------------------------------- */

export function Metric({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <p className="os-eyebrow text-neutral">{label}</p>
      <p
        className={`os-display os-num mt-2 text-3xl leading-none ${
          tone === "danger"
            ? "text-danger"
            : tone === "warning"
              ? "text-warning"
              : "text-near-black"
        }`}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-gray-dark">{detail}</p> : null}
    </>
  );

  const cls = "block rounded-xl border border-gray-mid bg-white p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-near-black`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* -------------------------------------------------------------------------
   Table shell. Wraps in an overflow container so wide tables scroll
   themselves instead of forcing the page to scroll sideways.
   ------------------------------------------------------------------------- */

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`os-eyebrow whitespace-nowrap px-4 py-2 text-left text-neutral ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-sm ${className}`}>{children}</td>;
}

/* -------------------------------------------------------------------------
   Field wrapper — a real <label>, always associated, with hint + error slots.
   ------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="os-eyebrow mb-1.5 block text-gray-dark">
        {label}
        {required ? <span className="ml-1 text-orange">*</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-neutral">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const INPUT =
  "min-h-11 w-full rounded-lg border border-gray-mid bg-white px-3 text-sm text-near-black placeholder:text-neutral/60 focus:border-orange focus:outline-none";

export const SELECT = `${INPUT} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="%2355524E" stroke-width="1.5"/></svg>')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9`;

export const TEXTAREA =
  "w-full rounded-lg border border-gray-mid bg-white px-3 py-2 text-sm text-near-black placeholder:text-neutral/60 focus:border-orange focus:outline-none";

/* -------------------------------------------------------------------------
   Inline error. Errors in Courts OS say what happened and what to do — this
   is the shell that renders that pair.
   ------------------------------------------------------------------------- */

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
    >
      <span aria-hidden="true">!</span>
      <div>{children}</div>
    </div>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
    >
      {children}
    </div>
  );
}
