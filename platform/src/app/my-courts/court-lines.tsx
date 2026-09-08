// Abstract court markings used as a quiet background texture — a free-throw
// arc and lane lines, drawn loose and cropped rather than a literal court
// diagram. Never a ball, never literal enough to compete with the content
// sitting on top of it.
export function CourtArc({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <circle cx="40" cy="330" r="240" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="40" cy="330" r="170" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M-40 150 H180" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M-40 210 H180" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
    </svg>
  );
}

// A single quiet diagonal seam line, for smaller cards that need one
// gesture of court geometry rather than a full arc composition.
export function CourtSeam({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <path d="M-20 40 L220 160" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M-20 80 L220 200" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    </svg>
  );
}
