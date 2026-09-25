"use client";

import { useState, useTransition } from "react";
import { setJerseySize } from "./actions";

export function JerseySelect({ athleteId, sizes, value }: { athleteId: string; sizes: string[]; value: string | null }) {
  const [current, setCurrent] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onChange(next: string) {
    setCurrent(next);
    setSaved(false);
    const fd = new FormData();
    fd.set("athleteId", athleteId);
    fd.set("jerseySize", next);
    startTransition(async () => {
      await setJerseySize(fd);
      setSaved(true);
    });
  }

  return (
    <span className="flex items-center gap-1.5">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className={`min-h-8 rounded-lg border px-1.5 text-xs ${
          current ? "border-green-600 bg-green-50 text-green-800 font-bold" : "border-gray-mid bg-white"
        }`}
      >
        <option value="">Jersey size…</option>
        {sizes.map((sz) => (
          <option key={sz} value={sz}>{sz}</option>
        ))}
      </select>
      <span className="w-10 text-xs text-gray-dark">{pending ? "Saving…" : saved ? "Saved" : ""}</span>
    </span>
  );
}
