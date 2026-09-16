"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { createLeaguePaymentIntent, confirmLeagueRegistration, applyLeaguePromoCode } from "./actions";
import { GaConversionEvent } from "@/components/ga-conversion-event";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type ReviewData = Awaited<ReturnType<typeof createLeaguePaymentIntent>>;

// Card entry uses Stripe's own Payment Element throughout — no custom card
// fields, no custom 3D Secure handling. stripe.confirmPayment() below is
// what pops the bank's challenge automatically when a card requires it.
function PayForm({ review, onDone }: { review: ReviewData; onDone: (result: { membershipSetupNeeded: boolean }) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      // allow_redirects: "never" on the PaymentIntent (server side) means
      // this never actually redirects — return_url is required by the SDK's
      // types regardless, and redirect: "if_required" keeps the guardian on
      // this page for the whole flow, including any 3D Secure challenge,
      // which Stripe.js pops in-page rather than navigating away for.
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      // card_declined and friends land here — nothing was created, the
      // guardian can just try a different card.
      setError(confirmError.message ?? "Your card was declined. Please try another card.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status !== "succeeded") {
      setError("Payment didn't complete. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = await confirmLeagueRegistration(review.registrationId, paymentIntent.id);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong finishing registration. Please try again.");
      return;
    }
    onDone({ membershipSetupNeeded: result.membershipSetupNeeded });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && <p className="font-body text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="min-h-[44px] rounded-full bg-orange px-6 font-sport text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay ${formatPrice(review.totalCents)} →`}
      </button>
    </form>
  );
}

// Families enter their own code (e.g. EVAL25) — nothing is applied
// automatically. Re-fetching the PaymentIntent's amount happens server-side
// in applyLeaguePromoCode; this just reflects the result back into review
// state so the displayed total and the amount Stripe actually confirms stay
// in sync.
function PromoCodeField({ review, onApplied }: { review: ReviewData; onApplied: (updated: ReviewData) => void }) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (review.creditCents > 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Promo code"
          className="min-w-0 flex-1 rounded-lg border border-gray-mid bg-white px-3 py-2 font-body text-sm text-near-black focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/25"
        />
        <button
          type="button"
          disabled={applying || !code.trim()}
          onClick={async () => {
            setApplying(true);
            setMessage(null);
            const result = await applyLeaguePromoCode(review.registrationId, code);
            setApplying(false);
            if (!result.ok) {
              setMessage({ text: result.error, ok: false });
              return;
            }
            setMessage({ text: "Promo code applied.", ok: true });
            onApplied({ ...review, totalCents: result.totalCents, creditCents: result.creditCents });
          }}
          className="shrink-0 rounded-lg border border-gray-mid px-3 py-2 font-sport text-xs font-bold uppercase tracking-wide text-near-black transition-colors hover:border-orange hover:text-orange disabled:opacity-50"
        >
          {applying ? "Applying…" : "Apply"}
        </button>
      </div>
      {message && (
        <p className={`font-body text-[12.5px] ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>
      )}
    </div>
  );
}

export function LeaguePaymentForm({ athleteId }: { athleteId: string }) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ membershipSetupNeeded: boolean } | null>(null);

  if (result) {
    return (
      <div className="rounded-lg border border-green-600 bg-green-50 p-4 font-body text-sm text-green-800">
        <GaConversionEvent
          event="purchase"
          valueCents={review?.totalCents ?? null}
          transactionId={review?.registrationId ?? null}
          itemName="Fall League Registration"
        />
        <p className="font-bold">You&rsquo;re registered — thanks!</p>
        {result.membershipSetupNeeded && (
          <p className="mt-1 text-[13px]">
            Your League payment went through, but we hit a snag setting up the membership. We&rsquo;ll
            follow up, or you can finish it now from your Home screen.
          </p>
        )}
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col gap-2">
        {loadError && <p className="font-body text-sm text-red-700">{loadError}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setLoadError(null);
            try {
              const data = await createLeaguePaymentIntent(athleteId);
              setReview(data);
            } catch (err) {
              setLoadError(err instanceof Error ? err.message : "Couldn't start registration.");
            } finally {
              setLoading(false);
            }
          }}
          className="min-h-[38px] w-fit rounded-full bg-orange px-4 font-sport text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-50"
        >
          {loading ? "Loading…" : "Register →"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-mid bg-white p-4">
      <div>
        <p className="font-body text-sm text-gray-dark">
          Due today: <span className="font-bold text-black">{formatPrice(review.totalCents)}</span>
        </p>
        {review.creditCents > 0 && (
          <p className="font-body text-[12.5px] text-gray-dark">
            {formatPrice(review.baseAmountCents)} &middot; ${(review.creditCents / 100).toFixed(0)} evaluation credit applied
          </p>
        )}
      </div>
      <PromoCodeField review={review} onApplied={setReview} />
      <Elements stripe={stripePromise} options={{ clientSecret: review.clientSecret }}>
        <PayForm review={review} onDone={setResult} />
      </Elements>
    </div>
  );
}
