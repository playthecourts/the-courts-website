"use client";

import { useState, type ReactNode } from "react";

// A pure show/hide toggle over content that's already rendered server-side —
// both sections' data is fetched either way, so switching tabs is instant
// with no refetch, same idea as the Sport/Month FilterRow in filter-bar.tsx.
const TABS = [
  { key: "all", label: "All" },
  { key: "single", label: "Single-Day" },
  { key: "multi", label: "Multi-Day" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function CampTypeToggle({ singleDay, multiDay }: { singleDay: ReactNode; multiDay: ReactNode }) {
  const [tab, setTab] = useState<TabKey>("all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex min-h-8 items-center justify-center rounded-full border px-3 font-sport text-xs font-bold uppercase tracking-wide ${
              tab === t.key
                ? "border-black bg-black text-white"
                : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div hidden={tab === "multi"} className="flex flex-col gap-3">
        {singleDay}
      </div>
      <div hidden={tab === "single"} className="flex flex-col gap-3">
        {multiDay}
      </div>
    </div>
  );
}
