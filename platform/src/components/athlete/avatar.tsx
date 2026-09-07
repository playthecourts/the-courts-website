import { initials as initialsFor } from "@/lib/athlete";

// The athlete's face across all four apps.
//
// When there's no photo the fallback is initials on brand orange — never a grey
// silhouette. A child without a photo yet should read as a member of the club,
// not as a missing record. The same component is used by the Parent App, Coach
// App, Front Desk and Courts OS so an athlete looks like the same person
// everywhere.

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; text: string; px: number }> = {
  sm: { box: "h-9 w-9", text: "text-[12px]", px: 36 },
  md: { box: "h-12 w-12", text: "text-[15px]", px: 48 },
  lg: { box: "h-20 w-20", text: "text-[24px]", px: 80 },
  xl: { box: "h-32 w-32", text: "text-[38px]", px: 128 },
};

export function AthleteAvatar({
  athlete,
  photoUrl,
  size = "md",
  className = "",
}: {
  athlete: { firstName: string; lastName: string; nickname?: string | null };
  /// A short-lived signed URL from lib/athlete-photo.ts. Never a public URL —
  /// there is no public URL for a child's photo in this system.
  photoUrl?: string | null;
  size?: Size;
  className?: string;
}) {
  const s = SIZES[size];
  const label = initialsFor(athlete);

  if (photoUrl) {
    return (
      // Plain <img>: the signed URL is single-use-ish and expires, so it must
      // not go through the Next image optimizer's cache.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={s.px}
        height={s.px}
        className={`${s.box} shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${s.box} ${s.text} flex shrink-0 items-center justify-center rounded-full bg-orange font-display font-black tracking-tight text-white ${className}`}
    >
      {label}
    </span>
  );
}
