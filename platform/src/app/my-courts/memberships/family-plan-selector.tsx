"use client";

import { useState } from "react";
import Link from "next/link";
import { startFamilyMembershipCheckout } from "./actions";

// Family Unlimited covers two athletes — asking which one, right where a
// parent picks the plan, means checkout never silently forgets a sibling.

export function FamilyPlanSelector({
  athleteId,
  membershipPlanId,
  otherAthletes,
}: {
  athleteId: string;
  membershipPlanId: string;
  otherAthletes: { id: string; firstName: string }[];
}) {
  const [secondAthleteId, setSecondAthleteId] = useState(otherAthletes[0]?.id ?? "");

  if (otherAthletes.length === 0) {
    return (
      <div className="rounded-md border border-gray-mid bg-gray-light px-3 py-2.5">
        <p className="font-body text-[13px] text-gray-dark">
          Family Unlimited covers two athletes — add another one first.
        </p>
        <Link href="/my-courts/athletes/new" className="mt-1 inline-block font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
          Add an Athlete &rarr;
        </Link>
      </div>
    );
  }

  return (
    <form action={startFamilyMembershipCheckout} className="flex flex-col gap-2">
      <input type="hidden" name="athleteId" value={athleteId} />
      <input type="hidden" name="membershipPlanId" value={membershipPlanId} />
      <p className="font-body text-[12.5px] text-gray-dark">Also covers:</p>
      <div className="flex flex-col gap-1.5">
        {otherAthletes.map((a) => (
          <label key={a.id} className="flex items-center gap-2 font-body text-[14px] text-near-black">
            <input
              type="radio"
              name="secondAthleteId"
              value={a.id}
              checked={secondAthleteId === a.id}
              onChange={() => setSecondAthleteId(a.id)}
              className="h-4 w-4 accent-orange"
            />
            {a.firstName}
          </label>
        ))}
      </div>
      <button
        type="submit"
        className="mt-1 min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
      >
        Select Plan
      </button>
    </form>
  );
}
