"use client";

import { useTransition } from "react";
import { cancelBooking } from "@/app/my-courts/actions";

export function CancelBookingButton({ bookingId, isPaid }: { bookingId: string; isPaid: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => cancelBooking(bookingId))}
        className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? "Cancelling…" : "Cancel"}
      </button>
      {isPaid && <span className="font-body text-[10px] text-gray-dark">No refunds</span>}
    </div>
  );
}
