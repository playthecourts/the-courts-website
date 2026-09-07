"use client";

import { useActionState, useState, useTransition } from "react";
import { updateOfferingPricing, connectStripe } from "../actions";
import { COURTS_TAX_CODES } from "@/lib/programs/tax";
import { formatCents } from "@/lib/programs/format";
import { Card, CardHeader, Field, INPUT, SELECT, BTN, Pill, ErrorNote, SuccessNote } from "../../_components/ui";

// Money, stated plainly. The "Booking rule" panel spells out in words what a
// Weekly Plan member, an Unlimited member and a non-member each experience —
// because "member pricing" silently meaning "free" is exactly the kind of
// ambiguity that turns into a refund conversation.

type Offering = {
  id: string;
  pricingModel: string;
  priceCents: number | null;
  memberPriceCents: number | null;
  singleDayPriceCents: number | null;
  depositCents: number | null;
  creditRule: string;
  creditsPerBooking: number;
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeMemberPriceId: string | null;
  stripeTaxCode: string | null;
  taxBehavior: string;
  allowSingleDay: boolean;
};

const dollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

const CREDIT_RULE_COPY: Record<string, string> = {
  uses_credit: "Booking consumes session credits from the family's Training Plan.",
  included: "Included with a Training Plan at no credit cost.",
  member_price: "Training Plan members pay the member price; everyone else pays full price.",
  separate_payment: "Training Plans grant nothing here — everyone pays.",
  free: "Free for everyone.",
};

export function PricingSection({
  offering,
  canEdit,
  canPublish,
}: {
  offering: Offering;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const [creditRule, setCreditRule] = useState(offering.creditRule);
  const [pricingModel, setPricingModel] = useState(offering.pricingModel);
  const [stripeMsg, setStripeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stripePending, startStripe] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (_prev: { ok?: boolean; error?: string } | null, fd: FormData) => {
      try {
        await updateOfferingPricing(offering.id, fd);
        return { ok: true };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not save." };
      }
    },
    null
  );

  const isFree = pricingModel === "free";

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Price" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Pricing model" htmlFor="pricingModel">
              <select id="pricingModel" name="pricingModel" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} className={SELECT} disabled={!canEdit}>
                <option value="free">Free</option>
                <option value="one_time">One-time</option>
                <option value="per_session">Per session</option>
                <option value="multi_day_package">Multi-day package</option>
                <option value="training_plan">Covered by Training Plan</option>
                <option value="deposit">Deposit</option>
              </select>
            </Field>
            {!isFree ? (
              <>
                <Field label="Standard price" htmlFor="priceCents" hint="Dollars.">
                  <input id="priceCents" name="priceCents" type="number" step="0.01" min="0" defaultValue={dollars(offering.priceCents)} className={INPUT} disabled={!canEdit} />
                </Field>
                <Field label="Training Plan member price" htmlFor="memberPriceCents" hint="Only if that benefit genuinely exists.">
                  <input id="memberPriceCents" name="memberPriceCents" type="number" step="0.01" min="0" defaultValue={dollars(offering.memberPriceCents)} className={INPUT} disabled={!canEdit} />
                </Field>
                {offering.allowSingleDay ? (
                  <Field label="Single-day price" htmlFor="singleDayPriceCents">
                    <input id="singleDayPriceCents" name="singleDayPriceCents" type="number" step="0.01" min="0" defaultValue={dollars(offering.singleDayPriceCents)} className={INPUT} disabled={!canEdit} />
                  </Field>
                ) : null}
                <Field label="Deposit" htmlFor="depositCents" hint="Leave blank for payment in full.">
                  <input id="depositCents" name="depositCents" type="number" step="0.01" min="0" defaultValue={dollars(offering.depositCents)} className={INPUT} disabled={!canEdit} />
                </Field>
              </>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Training Plan rule" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="How Training Plans apply" htmlFor="creditRule">
              <select id="creditRule" name="creditRule" value={creditRule} onChange={(e) => setCreditRule(e.target.value)} className={SELECT} disabled={!canEdit}>
                <option value="separate_payment">Not included — everyone pays</option>
                <option value="uses_credit">Uses session credits</option>
                <option value="included">Included, no credit used</option>
                <option value="member_price">Member price</option>
                <option value="free">Free for everyone</option>
              </select>
            </Field>
            {creditRule === "uses_credit" ? (
              <Field label="Credits per booking" htmlFor="creditsPerBooking">
                <input id="creditsPerBooking" name="creditsPerBooking" type="number" min="1" defaultValue={offering.creditsPerBooking} className={INPUT} disabled={!canEdit} />
              </Field>
            ) : null}
          </div>
          <div className="border-t border-gray-mid bg-warm-white px-4 py-3">
            <p className="os-eyebrow mb-1.5 text-near-black">Booking rule, as families will see it</p>
            <p className="text-sm text-gray-dark">{CREDIT_RULE_COPY[creditRule]}</p>
            {creditRule === "member_price" ? (
              <p className="os-num mt-1.5 text-sm text-gray-dark">
                Member {formatCents(offering.memberPriceCents)} · Non-member {formatCents(offering.priceCents)}
              </p>
            ) : null}
          </div>
        </Card>

        {!isFree ? (
          <Card>
            <CardHeader title="Tax" />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Stripe tax code" htmlFor="stripeTaxCode" hint="Chosen deliberately — never inferred from the program name." required>
                <select id="stripeTaxCode" name="stripeTaxCode" defaultValue={offering.stripeTaxCode ?? ""} className={SELECT} disabled={!canEdit} required>
                  <option value="">Choose a tax code…</option>
                  {COURTS_TAX_CODES.map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tax behavior" htmlFor="taxBehavior">
                <select id="taxBehavior" name="taxBehavior" defaultValue={offering.taxBehavior} className={SELECT} disabled={!canEdit}>
                  <option value="unspecified">Account default</option>
                  <option value="exclusive">Added on top</option>
                  <option value="inclusive">Included in the price</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <ul className="flex flex-col gap-1 text-xs text-neutral">
                  {COURTS_TAX_CODES.map((t) => (
                    <li key={t.code}><span className="text-gray-dark">{t.label}</span> — {t.hint}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ) : null}

        {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
        {state?.ok ? <SuccessNote>Saved.</SuccessNote> : null}

        {canEdit ? (
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={BTN.primary}>
              {pending ? "Saving…" : "Save Pricing"}
            </button>
          </div>
        ) : null}
      </form>

      {!isFree ? (
        <Card>
          <CardHeader title="Stripe" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              {offering.stripePriceId ? (
                <>
                  <Pill tone="success">Connected</Pill>
                  <p className="os-num mt-2 text-xs text-neutral">
                    Product {offering.stripeProductId} · Price {offering.stripePriceId}
                    {offering.stripeMemberPriceId ? ` · Member ${offering.stripeMemberPriceId}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <Pill tone="danger">Not connected</Pill>
                  <p className="mt-2 text-sm text-gray-dark">
                    Checkout won&apos;t work until this offering has a Stripe price.
                  </p>
                </>
              )}
            </div>
            {canPublish ? (
              <button
                type="button"
                disabled={stripePending}
                onClick={() =>
                  startStripe(async () => {
                    const r = await connectStripe(offering.id);
                    setStripeMsg(
                      r.ok
                        ? { ok: true, text: `Connected. Price ${r.priceId}.` }
                        : { ok: false, text: r.error }
                    );
                  })
                }
                className={BTN.secondary}
              >
                {stripePending ? "Connecting…" : offering.stripePriceId ? "Re-sync with Stripe" : "Connect Stripe"}
              </button>
            ) : null}
          </div>
          {stripeMsg ? (
            <div className="px-4 pb-4">
              {stripeMsg.ok ? <SuccessNote>{stripeMsg.text}</SuccessNote> : <ErrorNote>{stripeMsg.text}</ErrorNote>}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
