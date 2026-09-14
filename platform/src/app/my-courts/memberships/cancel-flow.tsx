"use client";

import { useState } from "react";
import { cancelMembership } from "./actions";
import { CANCELLATION_REASONS } from "./constants";

// Three steps, not one form: asking why before showing the effective date
// keeps a parent from cancelling reflexively and gives real signal on why
// families leave. "Didn't meet expectations" is the one reason that earns a
// follow-up question — every other reason is left alone, on purpose.
export function CancelMembershipFlow({
  athleteMembershipId,
  planName,
  effectiveDateLabel,
  mayRenewBeforeThat,
}: {
  athleteMembershipId: string;
  planName: string;
  effectiveDateLabel: string;
  mayRenewBeforeThat: boolean;
}) {
  const [step, setStep] = useState<"idle" | "reason" | "confirm">("idle");
  const [reason, setReason] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStep("reason")}
        className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
      >
        Cancel Membership
      </button>
    );
  }

  if (step === "reason") {
    return (
      <div className="rounded-lg border border-gray-mid bg-warm-stone p-4">
        <p className="mb-3 font-heading text-sm font-bold text-black">
          Why are you cancelling {planName}?
        </p>
        <div className="flex flex-col gap-2">
          {CANCELLATION_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 font-body text-sm text-black">
              <input
                type="radio"
                name="reason-preview"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {r}
            </label>
          ))}
        </div>
        {reason === "Didn't meet expectations" && (
          <div className="mt-3">
            <label className="mb-1 block font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
              What could we have done better?
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-mid px-3 py-2 font-body text-sm text-black"
            />
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={!reason}
            onClick={() => setStep("confirm")}
            className="rounded-full bg-black px-4 py-2 font-sport text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark"
          >
            Never Mind
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-mid bg-warm-stone p-4">
      <p className="font-heading text-sm font-bold text-black">
        {planName} will stay active through {effectiveDateLabel} — that&rsquo;s the required 30
        days&rsquo; notice.
      </p>
      <p className="mt-1 font-body text-sm text-gray-dark">
        {mayRenewBeforeThat
          ? "Your normal renewal falls within that window, so one more charge will go through before the membership ends. You can change your mind any time before then."
          : "You won’t be charged again after that, and you can change your mind any time before then."}
      </p>
      <form action={cancelMembership.bind(null, athleteMembershipId)} className="mt-4 flex gap-3">
        <input type="hidden" name="reason" value={reason} />
        <input type="hidden" name="feedback" value={feedback} />
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-2 font-sport text-xs font-bold uppercase tracking-wide text-white"
        >
          Confirm Cancellation
        </button>
        <button
          type="button"
          onClick={() => setStep("reason")}
          className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark"
        >
          Back
        </button>
      </form>
    </div>
  );
}
