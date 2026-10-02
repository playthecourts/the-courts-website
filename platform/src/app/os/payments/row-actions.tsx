"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendPaymentLink, setMembershipBillingDate, type PayResult } from "./actions";
import { BTN, INPUT } from "../_components/ui";

// Row actions for the Payments page. Payment is online only, so collecting a
// balance always means a Stripe payment link the family pays themselves.

function Note({ res }: { res: PayResult | null }) {
  if (!res) return null;
  return <p className={`mt-2 text-xs ${res.ok ? "text-success" : "text-danger"}`} role={res.ok ? "status" : "alert"}>{res.ok ? res.message : res.error}</p>;
}

export function OwedActions({
  kind,
  id,
  canSendLink,
}: {
  kind: "booking" | "registration";
  id: string;
  canSendLink: boolean;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [res, setRes] = useState<PayResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<PayResult>) =>
    start(async () => {
      const r = await fn();
      setRes(r);
      if (r.ok && r.url) setLink(r.url);
    });

  return (
    <div className="min-w-[14rem]">
      {kind === "registration" ? (
        <p className="text-xs text-gray-dark">Camp or league — the family finishes paying on its page in My Courts.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canSendLink && kind === "booking" && !link ? (
          <button type="button" className={BTN.primary} disabled={pending} onClick={() => run(() => sendPaymentLink(id, false))}>
            {pending ? "Making link…" : "Send Payment Link"}
          </button>
        ) : null}
      </div>

      {link ? (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-mid bg-gray-light p-3">
          <input readOnly aria-label="Payment link" className={`${INPUT} text-xs`} value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BTN.secondary}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy Link"}
            </button>
            <button type="button" className={BTN.secondary} disabled={pending} onClick={() => run(() => sendPaymentLink(id, true))}>
              {pending ? "Sending…" : "Email to Parent"}
            </button>
          </div>
        </div>
      ) : null}

      <Note res={res} />
    </div>
  );
}

export function BillingDateForm({ membershipId, current }: { membershipId: string; current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [res, setRes] = useState<PayResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`d-${membershipId}`}>Next billing date</label>
        <input id={`d-${membershipId}`} type="date" className={`${INPUT} w-40`} value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          type="button"
          className={BTN.secondary}
          disabled={pending || !value || value === current}
          title="Moves the next charge to this date. Nothing is charged or refunded now."
          onClick={() =>
            start(async () => {
              const r = await setMembershipBillingDate(membershipId, value);
              setRes(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? "Moving…" : "Move Date"}
        </button>
      </div>
      <Note res={res} />
    </div>
  );
}
