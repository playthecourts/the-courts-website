import Link from "next/link";
import type { AttentionItem, Severity } from "@/lib/os/attention";
import { EmptyState, Pill, type Tone } from "./ui";

// Severity is carried by an explicit word as well as colour — "Urgent" /
// "Needs Review" / "Heads Up" — so the queue is readable without colour
// vision and to a screen reader.
const SEVERITY: Record<Severity, { tone: Tone; label: string; bar: string }> = {
  critical: { tone: "danger", label: "Urgent", bar: "bg-danger" },
  warning: { tone: "warning", label: "Needs Review", bar: "bg-warning" },
  info: { tone: "info", label: "Heads Up", bar: "bg-info" },
};

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        headline="Nothing to Fix. Suspicious."
        detail="No failed payments, unsigned waivers, coverage gaps or court conflicts right now."
      />
    );
  }

  return (
    <ul className="divide-y divide-gray-mid">
      {items.map((item) => {
        const s = SEVERITY[item.severity];
        return (
          <li key={item.key} className="relative">
            <Link
              href={item.href}
              className="flex items-start gap-3 py-3 pl-5 pr-4 transition-colors hover:bg-warm-stone"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${s.bar}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={s.tone}>{s.label}</Pill>
                  <span className="os-heading text-sm text-near-black">{item.title}</span>
                </span>
                <span className="mt-1 block text-xs text-gray-dark">{item.detail}</span>
              </span>
              <span aria-hidden="true" className="os-eyebrow shrink-0 pt-1 text-neutral">
                Open →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
