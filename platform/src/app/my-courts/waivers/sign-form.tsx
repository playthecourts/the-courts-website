"use client";

import { useActionState } from "react";
import { signAthleteWaiver, signFamilyWaiver } from "@/app/my-courts/waivers/actions";
import type { ActionState } from "@/app/my-courts/athletes/actions";
import { ChoiceCard, CardStack, SubmitButton } from "@/components/athlete/form-ui";

/// Set when this waiver page was reached because it was blocking a
/// membership checkout. Carried as hidden fields so the sign action can
/// resume straight into Stripe once this was the last thing in the way,
/// instead of leaving the family to click back to Memberships and Subscribe
/// again themselves.
export type ResumeCheckout =
  | { kind: "standard"; athleteId: string; membershipPlanId: string }
  | { kind: "family"; athleteId: string; membershipPlanId: string; secondAthleteId: string }
  | { kind: "nextgen_legacy"; athleteId: string };

function ResumeCheckoutFields({ resume }: { resume?: ResumeCheckout }) {
  if (!resume) return null;
  return (
    <>
      <input type="hidden" name="resumeKind" value={resume.kind} />
      <input type="hidden" name="resumeAthleteId" value={resume.athleteId} />
      {"membershipPlanId" in resume && <input type="hidden" name="resumePlanId" value={resume.membershipPlanId} />}
      {"secondAthleteId" in resume && (
        <input type="hidden" name="resumeSecondAthleteId" value={resume.secondAthleteId} />
      )}
    </>
  );
}

/// One athlete-scope waiver, one specific athlete. Unchanged shape from
/// before this redesign — no coverage ambiguity here to solve.
export function AthleteSignForm({
  waiverId,
  athleteId,
  label,
  resume,
}: {
  waiverId: string;
  athleteId: string;
  label: string;
  resume?: ResumeCheckout;
}) {
  const action = signAthleteWaiver.bind(null, waiverId, athleteId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, { ok: true });

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-gray-mid bg-white p-4">
      <ResumeCheckoutFields resume={resume} />
      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[14px] font-bold text-near-black">
          {label} — type your full legal name to sign
        </span>
        <input
          name="typedName"
          required
          minLength={2}
          placeholder="Full name"
          className="w-full rounded-lg border border-gray-mid bg-white px-3.5 py-3 font-body text-[16px] text-near-black focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/25"
        />
      </label>
      {state.errors?.typedName && (
        <p className="font-body text-[13px] text-red-700">{state.errors.typedName}</p>
      )}
      <SubmitButton pendingLabel="Signing…">I Agree &amp; Sign</SubmitButton>
    </form>
  );
}

/// One family-scope waiver, a guardian-chosen SUBSET of their athletes. Only
/// the athletes not already covered by a prior signature are offered here —
/// no box pre-checked, including no "select all" default.
export function FamilySignForm({
  waiverId,
  uncoveredAthletes,
  resume,
}: {
  waiverId: string;
  uncoveredAthletes: { id: string; name: string }[];
  resume?: ResumeCheckout;
}) {
  const action = signFamilyWaiver.bind(null, waiverId);
  const [state, formAction] = useActionState<ActionState, FormData>(action, { ok: true });

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-mid bg-white p-4">
      <ResumeCheckoutFields resume={resume} />
      <div>
        <p className="mb-2 font-heading text-[14px] font-bold text-near-black">This waiver applies to:</p>
        <CardStack>
          {uncoveredAthletes.map((a) => (
            <ChoiceCard key={a.id} name="athleteId" value={a.id} headline={a.name} type="checkbox" />
          ))}
        </CardStack>
        {state.errors?.athleteId && (
          <p className="mt-2 font-body text-[13px] text-red-700">{state.errors.athleteId}</p>
        )}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-heading text-[14px] font-bold text-near-black">
          Type your full legal name to sign
        </span>
        <input
          name="typedName"
          required
          minLength={2}
          placeholder="Full name"
          className="w-full rounded-lg border border-gray-mid bg-white px-3.5 py-3 font-body text-[16px] text-near-black focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/25"
        />
      </label>
      {state.errors?.typedName && (
        <p className="font-body text-[13px] text-red-700">{state.errors.typedName}</p>
      )}
      <SubmitButton pendingLabel="Signing…">I Agree &amp; Sign</SubmitButton>
    </form>
  );
}
