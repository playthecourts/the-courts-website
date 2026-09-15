"use client";

import { signAthleteWaiver, signFamilyWaiver } from "@/app/my-courts/waivers/actions";
import { ChoiceCard, CardStack, SubmitButton } from "@/components/athlete/form-ui";

/// One athlete-scope waiver, one specific athlete. Unchanged shape from
/// before this redesign — no coverage ambiguity here to solve.
export function AthleteSignForm({
  waiverId,
  athleteId,
  label,
}: {
  waiverId: string;
  athleteId: string;
  label: string;
}) {
  const action = signAthleteWaiver.bind(null, waiverId, athleteId);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-gray-mid bg-white p-4">
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
}: {
  waiverId: string;
  uncoveredAthletes: { id: string; name: string }[];
}) {
  const action = signFamilyWaiver.bind(null, waiverId);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-gray-mid bg-white p-4">
      <div>
        <p className="mb-2 font-heading text-[14px] font-bold text-near-black">This waiver applies to:</p>
        <CardStack>
          {uncoveredAthletes.map((a) => (
            <ChoiceCard key={a.id} name="athleteId" value={a.id} headline={a.name} type="checkbox" />
          ))}
        </CardStack>
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
      <SubmitButton pendingLabel="Signing…">I Agree &amp; Sign</SubmitButton>
    </form>
  );
}
