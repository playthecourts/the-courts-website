"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addPickupPerson, removePickupPerson, type ActionState } from "@/app/my-courts/athletes/actions";
import { Question, TextInput, SubmitButton, SecondaryButton } from "@/components/athlete/form-ui";

// Authorized pickup.
//
// Useful for camps, Parents' Night Out, special events and drop-off
// programming. Deliberately NOT wired into ordinary training sessions — adding
// a formal pickup procedure to a Tuesday skills class would be process for its
// own sake.

export default function PickupForm({
  athleteId,
  displayName,
  guardianPickups,
  people,
}: {
  athleteId: string;
  displayName: string;
  guardianPickups: { id: string; name: string; relationship: string | null; authorizedForPickup: boolean }[];
  people: { id: string; name: string; relationship: string; phone: string; note: string | null }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(addPickupPerson, { ok: false });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setAdding(false);
      router.refresh();
    }
  }, [state, router]);

  const errors = state.errors ?? {};
  const authorizedGuardians = guardianPickups.filter((g) => g.authorizedForPickup);

  return (
    <div>
      <p className="mb-4 font-body text-[14px] leading-relaxed text-gray-dark">
        Who is allowed to pick up {displayName}?
      </p>

      {authorizedGuardians.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
            Parents + Guardians
          </p>
          <ul className="flex flex-col gap-2">
            {authorizedGuardians.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border border-gray-mid bg-white px-4 py-3 font-body text-[15px] text-near-black"
              >
                {g.name}
                {g.relationship && (
                  <span className="ml-2 text-[13.5px] text-gray-dark">{g.relationship}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-body text-[12.5px] text-gray-dark">
            Change these under Parents + Guardians.
          </p>
        </div>
      )}

      <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
        Other Authorized Adults
      </p>
      {people.length === 0 ? (
        <p className="mb-4 font-body text-[14px] text-gray-dark">No one else added yet.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {people.map((p) => (
            <li key={p.id} className="rounded-lg border border-gray-mid bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-[15px] font-bold text-near-black">{p.name}</p>
                  <p className="mt-0.5 font-body text-[13.5px] text-gray-dark">
                    {p.relationship} · {p.phone}
                  </p>
                  {p.note && (
                    <p className="mt-1 font-body text-[13px] text-gray-dark">{p.note}</p>
                  )}
                </div>
                <form action={removePickupPerson.bind(null, athleteId, p.id)}>
                  <button
                    type="submit"
                    className="font-sport text-[11px] font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-danger"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={formAction} className="rounded-xl border border-gray-mid bg-white p-4">
          <input type="hidden" name="athleteId" value={athleteId} />
          <Question label="Name" error={errors.name}>
            <TextInput name="name" required />
          </Question>
          <Question label="Relationship to Athlete" error={errors.relationship}>
            <TextInput name="relationship" placeholder="Grandmother, Neighbor…" required />
          </Question>
          <Question label="Phone" error={errors.phone}>
            <TextInput type="tel" name="phone" required />
          </Question>
          <Question label="Note" optional>
            <TextInput name="note" placeholder="Camp weeks only, carpool Thursdays…" />
          </Question>
          <SubmitButton>Add Person</SubmitButton>
          <div className="mt-2.5">
            <SecondaryButton type="button" onClick={() => setAdding(false)}>
              Cancel
            </SecondaryButton>
          </div>
        </form>
      ) : (
        <SecondaryButton type="button" onClick={() => setAdding(true)}>
          + Add Another Authorized Pickup Person
        </SecondaryButton>
      )}
    </div>
  );
}
