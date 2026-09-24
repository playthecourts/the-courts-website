"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "@/app/my-courts/actions";

export function CancelBookingButton({
  bookingId,
  isDropIn,
  hasMoneyOrCredit,
  willRefund,
}: {
  bookingId: string;
  isDropIn: boolean;
  hasMoneyOrCredit: boolean;
  willRefund: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const policyText = !hasMoneyOrCredit
    ? null
    : !isDropIn
    ? "Camps and League registrations are non-refundable — cancelling won't refund your payment."
    : willRefund
    ? "This is more than 12 hours before the session, so your payment or credit will be refunded."
    : "This session starts in less than 12 hours, so per our cancellation policy it won't be refunded.";

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5 rounded-lg border border-gray-mid bg-white p-2.5">
        {policyText && (
          <p className="max-w-[220px] text-right font-body text-xs leading-snug text-gray-dark">
            {policyText}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-gray-dark"
          >
            Never Mind
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => cancelBooking(bookingId))}
            className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-red-600 disabled:opacity-50"
          >
            {isPending ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-gray-dark hover:text-red-600"
    >
      Cancel
    </button>
  );
}
