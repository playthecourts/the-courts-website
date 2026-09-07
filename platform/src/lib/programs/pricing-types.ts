// Shared shape, importable from both server and client code.

export type BookingRule =
  | { kind: "uses_credit"; credits: number; planName: string; remaining: number }
  | { kind: "credit_exhausted"; planName: string; priceCents: number | null }
  | { kind: "included"; planName: string }
  | { kind: "member_price"; priceCents: number | null; planName: string }
  | { kind: "full_price"; priceCents: number | null }
  | { kind: "free" };
