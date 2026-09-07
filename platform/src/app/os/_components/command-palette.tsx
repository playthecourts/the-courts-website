"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Hit = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_LABEL: Record<string, string> = {
  family: "Family",
  athlete: "Athlete",
  program: "Program",
  team: "Team",
  coach: "Coach",
  lead: "Lead",
};

// Cmd/Ctrl+K search. Results come from the server, which re-checks permissions
// on every request — this component never decides what someone may see.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // Debounced fetch. AbortController so a slow earlier response can't
  // overwrite the results for a newer query.
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/os/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setHits(data.results ?? []);
        setActive(0);
      } catch {
        /* aborted or offline — leave the previous results in place */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const go = useCallback(
    (hit: Hit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router]
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="os-focus fixed bottom-4 right-4 z-40 hidden min-h-11 items-center gap-2 rounded-full border border-gray-mid bg-white px-4 text-sm text-gray-dark shadow-sm hover:border-near-black lg:flex"
      >
        Search The Courts…
        <kbd className="os-eyebrow rounded bg-warm-stone px-1.5 py-1 text-neutral">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-near-black/40 px-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search The Courts"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-mid bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            }
          }}
          placeholder="Search families, athletes, programs, teams, coaches…"
          aria-label="Search The Courts"
          className="w-full border-b border-gray-mid px-4 py-4 text-base text-near-black placeholder:text-neutral/60 focus:outline-none"
        />
        <div className="max-h-[55vh] overflow-y-auto" role="listbox" aria-label="Search results">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral">
              Type at least two characters.
            </p>
          ) : loading && hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral">
              Nothing matches “{query}”.
            </p>
          ) : (
            <ul>
              {hits.map((hit, i) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                      i === active ? "bg-warm-stone" : "bg-white"
                    }`}
                  >
                    <span className="os-eyebrow w-16 shrink-0 text-neutral">
                      {TYPE_LABEL[hit.type] ?? hit.type}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-near-black">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-gray-dark">{hit.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
