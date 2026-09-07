"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSafety, type ActionState } from "@/app/my-courts/athletes/actions";
import {
  StepHeader,
  Question,
  TextInput,
  TextArea,
  YesNo,
  SubmitButton,
} from "@/components/athlete/form-ui";

// Step 3 — safety. Calm, short, and asked once.
//
// The medical question is a yes/no gate before any free text, so a family with
// nothing to report answers in one tap instead of staring at an empty medical
// box wondering what is expected of them. The follow-up asks only for what
// staff need in the building — not a medical history.

export default function SafetyForm({
  athlete,
  displayName,
  guardians,
  nextHref,
  eyebrow,
  title = "A Few Important Things",
  sub,
  submitLabel = "Continue",
}: {
  athlete: {
    id: string;
    hasMedicalInfo: boolean;
    medicalNotes: string | null;
    emergencyContacts: { id: string; name: string; relationship: string; phone: string; guardianId: string | null }[];
  };
  displayName: string;
  guardians: { id: string; name: string; phone: string | null; relationship: string | null }[];
  nextHref: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveSafety, { ok: false });

  const existing = athlete.emergencyContacts[0];
  const [hasMedical, setHasMedical] = useState<"yes" | "no" | null>(
    athlete.hasMedicalInfo ? "yes" : athlete.medicalNotes === null && !athlete.hasMedicalInfo ? null : "no"
  );
  const [sameAsGuardian, setSameAsGuardian] = useState(Boolean(existing?.guardianId));
  const [contact, setContact] = useState({
    name: existing?.name ?? "",
    relationship: existing?.relationship ?? "",
    phone: existing?.phone ?? "",
    guardianId: existing?.guardianId ?? "",
  });

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  const errors = state.errors ?? {};

  /// "Same as Parent / Guardian" copies the values in rather than storing a
  /// pointer alone — the front desk needs a number to dial without a join, and
  /// the parent can still edit it afterwards.
  function useGuardian(id: string) {
    const g = guardians.find((x) => x.id === id);
    if (!g) return;
    setContact({
      name: g.name,
      relationship: g.relationship ?? "Parent/Guardian",
      phone: g.phone ?? "",
      guardianId: g.id,
    });
    setSameAsGuardian(true);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />
      <StepHeader eyebrow={eyebrow} title={title} sub={sub} />

      <Question
        label={`Does ${displayName} have any medical conditions, allergies, or health information we should be aware of while they're at The Courts?`}
      >
        <YesNo name="hasMedicalInfo" defaultValue={hasMedical} onChangeValue={setHasMedical} />
      </Question>

      {hasMedical === "yes" && (
        <Question
          label="What should we know?"
          hint="Please include anything our staff may need to know to help keep your athlete safe while participating."
          error={errors.medicalNotes}
        >
          <TextArea name="medicalNotes" defaultValue={athlete.medicalNotes ?? ""} rows={4} />
          <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
            Only staff working with {displayName} can see this. It never appears on their Player
            Card, on team rosters, or in anything we publish.
          </p>
        </Question>
      )}

      <div className="my-7 border-t border-gray-mid" />

      <h2 className="mb-4 font-heading text-[17px] font-bold text-near-black">Emergency Contact</h2>

      {guardians.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {guardians.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => useGuardian(g.id)}
              className="min-h-[42px] rounded-full border border-gray-mid bg-white px-4 font-body text-[14px] text-near-black hover:border-orange"
            >
              Same as {g.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <input type="hidden" name="sameAsGuardian" value={sameAsGuardian ? "yes" : "no"} />
      <input type="hidden" name="sameAsGuardianId" value={sameAsGuardian ? contact.guardianId : ""} />

      <Question label="Name" error={errors.emergencyName}>
        <TextInput
          name="emergencyName"
          value={contact.name}
          onChange={(e) => setContact({ ...contact, name: e.target.value })}
          required
        />
      </Question>

      <div className="grid grid-cols-2 gap-3">
        <Question label="Relationship" error={errors.emergencyRelationship}>
          <TextInput
            name="emergencyRelationship"
            value={contact.relationship}
            onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
            placeholder="Mom, Grandpa…"
            required
          />
        </Question>
        <Question label="Phone" error={errors.emergencyPhone}>
          <TextInput
            type="tel"
            name="emergencyPhone"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            required
          />
        </Question>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
