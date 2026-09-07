import type { MediaConsentStatus } from "@/generated/prisma/enums";
import { staffMediaLabel } from "@/lib/media-consent";

// Operational status chips for staff surfaces.
//
// Every one pairs colour with a word, never colour alone — the Coach App gets
// used courtside in bad light, and the Front Desk is read at a glance by
// someone talking to a parent at the same time.

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "danger" | "warning" | "success" | "neutral" | "info";
}) {
  const tones = {
    danger: "bg-danger-bg text-danger",
    warning: "bg-warning-bg text-warning",
    success: "bg-success-bg text-success",
    neutral: "bg-neutral-bg text-neutral",
    info: "bg-info-bg text-info",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-sport text-[10.5px] font-bold uppercase tracking-[0.1em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * What staff see about media permission. Never the release text, never the
 * guardian's name — three words that answer "may I photograph this kid".
 * An unanswered question is shown as its own state and treated as "ask first",
 * because silence is not consent.
 */
export function MediaStatusBadge({ status }: { status: MediaConsentStatus | null | undefined }) {
  const label = staffMediaLabel(status);
  if (status === "media_ok") return <Chip tone="success">{label}</Chip>;
  if (status === "media_limited") return <Chip tone="warning">{label}</Chip>;
  if (status === "media_no") return <Chip tone="danger">{label}</Chip>;
  return <Chip tone="neutral">{label}</Chip>;
}

/**
 * The restrained health indicator. It says that information EXISTS and has to
 * be opened deliberately — the detail never rides along in a roster row where
 * it would be read by whoever happens to be looking at the tablet.
 */
export function HealthAlertBadge() {
  return <Chip tone="warning">Important Health Info</Chip>;
}

/**
 * Pickup restriction, as coaches see it. Deliberately an instruction and not a
 * summary of the family's legal situation — the custody detail itself is
 * owner/admin/front-desk only.
 */
export function PickupRestrictionBadge() {
  return <Chip tone="danger">Pickup Restriction</Chip>;
}
