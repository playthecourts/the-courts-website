"use client";

import { useState, type ReactNode } from "react";

type Item = { id: string; sport: "basketball" | "volleyball" | "other"; month: string; node: ReactNode };

const SPORTS = [
  { key: "all", label: "All Sports" },
  { key: "basketball", label: "Basketball" },
  { key: "volleyball", label: "Volleyball" },
] as const;

function FilterRow({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`flex min-h-8 items-center justify-center rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${
            value === o.key
              ? "border-black bg-black text-white"
              : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CampFilterBar({ items, months }: { items: Item[]; months: string[] }) {
  const [sport, setSport] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");

  const visible = items.filter(
    (item) => (sport === "all" || item.sport === sport) && (month === "all" || item.month === month)
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <FilterRow options={[{ key: "all", label: "All" }, ...months.map((m) => ({ key: m, label: m }))]} value={month} onChange={setMonth} />
        <FilterRow options={SPORTS as unknown as { key: string; label: string }[]} value={sport} onChange={setSport} />
      </div>

      <div className="flex flex-col gap-6">
        {visible.map((item) => (
          <div key={item.id}>{item.node}</div>
        ))}
        {visible.length === 0 && (
          <div className="rounded-xl border border-gray-mid bg-white p-6 text-center">
            <p className="font-body text-sm text-gray-dark">No camps match those filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
