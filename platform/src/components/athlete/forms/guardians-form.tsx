"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGuardian,
  updateGuardian,
  removeGuardian,
  updateGuardianPickup,
  type ActionState,
} from "@/app/my-courts/athletes/actions";
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
//
// Because they belong to the family, not to one athlete, everyone listed here
// shows up on every athlete — the note at the top says so, since a parent
// adding someone "for" one kid is the easy mistake to make.

type GuardianRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  isPrimary: boolean;
  authorizedForPickup: boolean;
  hasLogin: boolean;
  livesWithAthlete?: boolean | null;
  isSelf?: boolean;
  contactEditable?: boolean;
};

export default function GuardiansForm({
  athleteId,
  guardians,
  nextHref,
}: {
  athleteId: string;
  guardians: GuardianRow[];
  nextHref: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(guardians.length === 0);
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await addGuardian(prev, fd);
    if (r.ok) {
      setAdding(false);
      router.refresh();
    }
    return r;
  }, { ok: false });

  const errors = state.errors ?? {};

  return (
    <div>
      <p className="mb-4 rounded-lg bg-orange/10 px-3.5 py-3 font-body text-[13.5px] text-near-black">
        Parents and guardians are shared across <strong>all your athletes</strong>. Anyone you add here shows up on
        every child in your family.
      </p>

      <ul className="mb-5 flex flex-col gap-2.5">
        {guardians.map((g) => (
          <GuardianCard key={g.id} athleteId={athleteId} g={g} />
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
            Back to Family + Safety →
          </a>
        </div>
      )}
    </div>
  );
}

function GuardianCard({ athleteId, g }: { athleteId: string; g: GuardianRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await updateGuardian(prev, fd);
    if (r.ok) {
      setEditing(false);
      router.refresh();
    }
    return r;
  }, { ok: false });

  const errors = state.errors ?? {};
  const [first, ...rest] = g.name.split(" ");
  const last = rest.join(" ");
  // Someone with their own login (other than you) is removed by staff, and
  // you can't remove yourself.
  const removable = !g.isSelf && !g.hasLogin;

  if (editing) {
    return (
      <li className="rounded-xl border border-orange bg-white p-4">
        <form action={formAction}>
          <input type="hidden" name="athleteId" value={athleteId} />
          <input type="hidden" name="guardianId" value={g.id} />
          <h3 className="mb-4 font-heading text-[15px] font-bold text-near-black">Edit {g.name}</h3>

          {g.contactEditable ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Question label="First Name" error={errors.firstName}>
                  <TextInput name="firstName" defaultValue={first} required />
                </Question>
                <Question label="Last Name" error={errors.lastName}>
                  <TextInput name="lastName" defaultValue={last} required />
                </Question>
              </div>
              {g.isSelf ? (
                <p className="mb-3 font-body text-[12.5px] text-gray-dark">
                  Your email is how you sign in, so it can&apos;t be changed here.
                </p>
              ) : (
                <Question label="Email" optional error={errors.email}>
                  <TextInput type="email" name="email" defaultValue={g.email ?? ""} />
                </Question>
              )}
              <Question label="Phone" optional>
                <TextInput type="tel" name="phone" defaultValue={g.phone ?? ""} />
              </Question>
            </>
          ) : (
            <p className="mb-3 font-body text-[12.5px] text-gray-dark">
              {g.name} manages their own name and contact details through their login.
            </p>
          )}

          <Question label="Relationship to Athlete" error={errors.relationship}>
            <TextInput name="relationship" defaultValue={g.relationship ?? ""} required />
          </Question>

          <Question label="Primary contact?">
            <ChipRow>
              <ChoiceChip name="isPrimary" type="radio" value="no" label="No" defaultChecked={!g.isPrimary} />
              <ChoiceChip name="isPrimary" type="radio" value="yes" label="Yes" defaultChecked={g.isPrimary} />
            </ChipRow>
          </Question>

          <Question label="Lives with athlete?" optional>
            <ChipRow>
              <ChoiceChip
                name="livesWithAthlete"
                type="radio"
                value="yes"
                label="Yes"
                defaultChecked={g.livesWithAthlete === true}
              />
              <ChoiceChip
                name="livesWithAthlete"
                type="radio"
                value="no"
                label="No"
                defaultChecked={g.livesWithAthlete === false}
              />
            </ChipRow>
          </Question>

          {errors.form && <p className="mb-3 font-body text-[13px] text-danger">{errors.form}</p>}

          <SubmitButton>Save</SubmitButton>
          <div className="mt-2.5">
            <SecondaryButton type="button" onClick={() => setEditing(false)}>
              Cancel
            </SecondaryButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-gray-mid bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-[15px] font-bold text-near-black">
            {g.name}
            {g.isSelf && <span className="ml-1.5 font-body text-[13px] font-normal text-gray-dark">(you)</span>}
            {g.isPrimary && (
              <span className="ml-2 rounded-full bg-orange/10 px-2 py-0.5 font-sport text-[12px] font-bold uppercase tracking-[0.1em] text-orange">
                Primary
              </span>
            )}
          </p>
          <p className="mt-0.5 font-body text-[13.5px] text-gray-dark">
            {[g.relationship, g.phone, g.email].filter(Boolean).join(" · ") || "No contact details yet"}
          </p>
          <p className="mt-1 font-body text-[12.5px] text-gray-dark">
            {g.hasLogin ? "Has portal access" : "No portal access yet — they can sign up with this email any time."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 font-sport text-xs font-bold uppercase tracking-[0.1em] text-orange hover:text-orange-hover"
        >
          Edit
        </button>
      </div>

      <form
        action={updateGuardianPickup.bind(null, athleteId, g.id, !g.authorizedForPickup)}
        className="mt-3 border-t border-gray-mid pt-3"
      >
        <button type="submit" className="flex w-full items-center justify-between text-left">
          <span className="font-body text-[14px] text-near-black">Authorized for pickup</span>
          <span
            className={`font-sport text-xs font-bold uppercase tracking-[0.1em] ${
              g.authorizedForPickup ? "text-success" : "text-gray-dark"
            }`}
          >
            {g.authorizedForPickup ? "Yes · tap to change" : "No · tap to change"}
          </span>
        </button>
      </form>

      {removable && (
        <div className="mt-3 border-t border-gray-mid pt-3">
          {confirmingRemove ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-body text-[13.5px] text-near-black">
                Remove {g.name} from all your athletes?
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  disabled={removing}
                  onClick={() =>
                    startRemove(async () => {
                      const r = await removeGuardian(athleteId, g.id);
                      if (r.ok) router.refresh();
                      else setRemoveError(r.error ?? "Couldn't remove them. Try again.");
                    })
                  }
                  className="font-sport text-xs font-bold uppercase tracking-[0.1em] text-danger"
                >
                  {removing ? "Removing…" : "Yes, remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="font-sport text-xs font-bold uppercase tracking-[0.1em] text-gray-dark"
                >
                  Cancel
                </button>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="font-sport text-xs font-bold uppercase tracking-[0.1em] text-gray-dark hover:text-danger"
            >
              Remove from family
            </button>
          )}
          {removeError && <p className="mt-2 font-body text-[13px] text-danger">{removeError}</p>}
        </div>
      )}
    </li>
  );
}
