// Small line-weight glyphs for sport indicators and quick-link tiles. Kept
// geometric and restrained on purpose — a seam arc reads as "basketball"
// without drawing a literal cartoon ball, and the set shares one visual
// language with the bottom-nav icons (round caps, thin stroke).

type GlyphProps = { className?: string };

const common = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function BasketballGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17" />
      <path d="M6 5.5c2.2 2.4 2.2 10.6 0 13M18 5.5c-2.2 2.4-2.2 10.6 0 13" />
    </svg>
  );
}

export function VolleyballGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5c3.5 2.4 3.5 15 0 17M6.2 6.2c3.6 1.2 8 1.2 11.6 0M4 15.5c3.8-1.6 12.2-1.6 16 0" />
    </svg>
  );
}

export function CampGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <path d="M4 19 12 5l8 14" />
      <path d="M9 19l3-6 3 6" />
    </svg>
  );
}

export function LeagueGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 12v3M9 19h6M10.5 15h3l.5 4h-4l.5-4Z" />
    </svg>
  );
}

export function DrDishGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5.5 20c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5" />
      <path d="M12 13.5v-2" />
    </svg>
  );
}

export function ArrowGlyph({ className }: GlyphProps) {
  return (
    <svg {...common} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
