"use client";

import { useMemo, useRef, useState } from "react";
import { INPUT } from "../_components/ui";

export type PickerOption = { id: string; label: string };

// Type-to-find athlete picker. Replaces a native <select>: on an iPad that
// opens a scroll wheel with no search, so finding "Wilson" meant scrolling
// past every name before it. Here you type any part of a first or last name
// and tap the match. The chosen id rides along in a hidden input so it works
// inside a plain <form action>.
export function AthletePicker({
  name,
  options,
  placeholder = "Search athletes…",
  id,
}: {
  name: string;
  options: PickerOption[];
  placeholder?: string;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<PickerOption | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options.slice(0, 50);
    return options.filter((o) => {
      const l = o.label.toLowerCase();
      return words.every((w) => l.includes(w));
    }).slice(0, 50);
  }, [query, options]);

  if (chosen) {
    return (
      <div className="flex min-w-56 flex-1 items-center gap-2 sm:flex-none">
        <input type="hidden" name={name} value={chosen.id} />
        <span className="flex min-h-11 flex-1 items-center rounded-lg border border-orange bg-orange/5 px-3 text-sm text-near-black">
          {chosen.label}
        </span>
        <button
          type="button"
          onClick={() => {
            setChosen(null);
            setQuery("");
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="os-eyebrow min-h-11 px-2 text-orange underline underline-offset-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-w-56 flex-1 sm:flex-none">
      {/* Empty hidden value so a submit without a pick fails cleanly server-side. */}
      <input type="hidden" name={name} value="" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={INPUT}
      />
      {open ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-mid bg-white shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-gray-dark">No athletes match &ldquo;{query}&rdquo;.</li>
          ) : (
            matches.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  // onMouseDown so the pick lands before the input's blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setChosen(o);
                    setOpen(false);
                  }}
                  className="block min-h-11 w-full border-b border-gray-mid/60 px-3 py-2.5 text-left text-sm text-near-black last:border-b-0 hover:bg-orange/5"
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
