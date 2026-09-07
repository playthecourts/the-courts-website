"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addGuardian, updateGuardianPickup, type ActionState } from "@/app/my-courts/athletes/actions";
import {
  Question,
  TextInput,
  ChoiceChip,
  ChipRow,
  SubmitButton,
  SecondaryButton,
} from "@/components/athlete/form-ui";

// Parents + guardians.
//
// Two rules this screen exists to honour: a second guardian never creates a
// second family, and one guardian is enough. Co-parents, grandparents raising
// a grandchild, and single-parent households all land on the same household
// record with different people attached to it.

export default function GuardiansForm({
  athleteId,
  guardians,
  nextHref,
}: {
  athleteId: string;
  guardians: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    relationship: string | null;
    isPrimary: boolean;
    authorizedForPickup: boolean;
    hasLogin: boolean;
  }[];
  nextHref: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(addGuardian, { ok: false });
  const [adding, setAdding] = useState(guardians.length === 0);

  useEffect(() => {
    if (state.ok) {
      setAdding(false);
      router.refresh();
    }
  }, [state, router]);

  const errors = state.errors ?? {};

  return (
    <div>
      <ul className="mb-5 flex flex-col gap-2.5">
        {guardians.map((g) => (
          <li key={g.id} className="rounded-xl border border-gray-mid bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading text-[15px] font-bold text-near-black">
                  {g.name}
                  {g.isPrimary && (
                    <span className="ml-2 rounded-full bg-orange/10 px-2 py-0.5 font-sport text-[10px] font-bold uppercase tracking-[0.1em] text-orange">
                      Primary
                    </span>
                  )}
                </p>
                <p className="mt-0.5 font-body text-[13.5px] text-gray-dark">
                  {[g.relationship, g.phone, g.email].filter(Boolean).join(" · ") || "No contact details yet"}
                </p>
                {!g.hasLogin && (
                  <p className="mt-1 font-body text-[12.5px] text-gray-dark">
                    No account yet — they can sign up with this email any time.
                  </p>
                )}
              </div>
            </div>

            <form
              action={updateGuardianPickup.bind(null, athleteId, g.id, !g.authorizedForPickup)}
              className="mt-3 border-t border-gray-mid pt-3"
            >
              <button
                type="submit"
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-body text-[14px] text-near-black">Authorized for pickup</span>
                <span
                  className={`font-sport text-[11px] font-bold uppercase tracking-[0.1em] ${
                    g.authorizedForPickup ? "text-success" : "text-gray-dark"
                  }`}
                >
                  {g.authorizedForPickup ? "Yes · tap to change" : "No · tap to change"}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      {adding ? (
        <form action={formAction} className="rounded-xl border border-gray-mid bg-white p-4">
          <input type="hidden" name="athleteId" value={athleteId} />
          <h3 className="mb-4 font-heading text-[15px] font-bold text-near-black">
            Add a parent or guardian
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <Question label="First Name" error={errors.firstName}>
              <TextInput name="firstName" required />
            </Question>
            <Question label="Last Name" error={errors.lastName}>
              <TextInput name="lastName" required />
            </Question>
          </div>

          <Question label="Relationship to Athlete" error={errors.relationship}>
            <TextInput name="relationship" placeholder="Mom, Dad, Grandmother…" required />
          </Question>

          <Question label="Email" optional>
            <TextInput type="email" name="email" />
          </Question>

          <Question label="Phone" optional>
            <TextInput type="tel" name="phone" />
          </Question>

          <Question label="Primary contact?">
            <ChipRow>
              <ChoiceChip name="isPrimary" type="radio" value="no" label="No" defaultChecked />
              <ChoiceChip name="isPrimary" type="radio" value="yes" label="Yes" />
            </ChipRow>
          </Question>

          <Question label="Authorized for pickup?">
            <ChipRow>
              <ChoiceChip name="authorizedForPickup" type="radio" value="yes" label="Yes" defaultChecked />
              <ChoiceChip name="authorizedForPickup" type="radio" value="no" label="No" />
            </ChipRow>
          </Question>

          <Question label="Lives with athlete?" optional>
            <ChipRow>
              <ChoiceChip name="livesWithAthlete" type="radio" value="yes" label="Yes" />
              <ChoiceChip name="livesWithAthlete" type="radio" value="no" label="No" />
            </ChipRow>
          </Question>

          <SubmitButton>Add Guardian</SubmitButton>
          {guardians.length > 0 && (
            <div className="mt-2.5">
              <SecondaryButton type="button" onClick={() => setAdding(false)}>
                Cancel
              </SecondaryButton>
            </div>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-2.5">
          <SecondaryButton type="button" onClick={() => setAdding(true)}>
            + Add Another Parent or Guardian
          </SecondaryButton>
          <a
            href={nextHref}
            className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-orange px-5 font-sport text-[15px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            Done
          </a>
        </div>
      )}
    </div>
  );
}
