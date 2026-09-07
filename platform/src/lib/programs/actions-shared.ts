import "server-only";

// Small parsing helpers shared by the builder's server actions. Kept apart from
// the actions themselves so the parsing rules (what an empty string means, how
// dollars become cents) are stated once.

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function reqStr(fd: FormData, key: string, label: string): string {
  const v = str(fd, key);
  if (v === null) throw new Error(`${label} is required.`);
  return v;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n === null ? null : Math.round(n);
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

/// Dollars in the form, cents in the database. Rounded, because floating-point
/// dollars are how a $24.99 price becomes 2498.
export function cents(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n === null ? null : Math.round(n * 100);
}

/// A <input type="datetime-local"> value carries no timezone. Appending "Z"
/// parses it as literal UTC, matching how every session time in this codebase
/// is stored and rendered. One facility, one wall clock.
export function localDateTime(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v === null ? null : new Date(`${v}Z`);
}

export function dateOnly(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v === null ? null : new Date(`${v}T00:00:00Z`);
}

/// "17:30" → 1050 minutes from midnight.
export function timeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function list(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/// Multi-line textarea → array of trimmed lines. Used for "What to bring".
export function lines(fd: FormData, key: string): string[] {
  const v = str(fd, key);
  if (!v) return [];
  return v
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
