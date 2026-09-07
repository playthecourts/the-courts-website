"use client";

import { useTransition } from "react";
import { setRsvp } from "@/app/my-courts/actions";

const OPTIONS = [
  { value: "going" as const, label: "Going" },
  { value: "not_going" as const, label: "Can't Make It" },
  { value: "not_sure" as const, label: "Not Sure Yet" },
];

export function RsvpButtons({
  bookingId,
  current,
}: {
  bookingId: string;
  current: "going" | "not_going" | "not_sure" | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => setRsvp(bookingId, opt.value))}
            className={`min-h-[32px] rounded-full border px-3 font-sport text-[11px] font-bold uppercase tracking-wide disabled:opacity-50 ${
              active ? "border-orange bg-orange text-white" : "border-gray-mid bg-white text-gray-dark"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
