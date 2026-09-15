"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveFamilySafety, type ActionState } from "@/app/my-courts/athletes/actions";
import { Question, TextInput, TextArea, YesNo, SubmitButton } from "@/components/athlete/form-ui";

type Guardian = { id: string; name: string; phone: string | null; relationship: string | null };
type Contact = { name: string; relationship: string; phone: string; guardianId: string | null };

// Safety + Emergency, consolidated: health information, the primary AND
// backup emergency contact, and pickup/custody restrictions all save
// together with one button at the bottom — no more separate saves per
// subsection. A guardian already on the family account can be used as
// either contact with one tap instead of retyping their own info.

function ContactSection({
  prefix,
  title,
  helper,
  guardians,
  athleteFirstName,
  initial,
  errors,
}: {
  prefix: "primary" | "backup";
  title: string;
  helper: string;
  guardians: Guardian[];
  athleteFirstName: string;
  initial: Contact;
  errors: Record<string, string>;
}) {
  const [useGuardianId, setUseGuardianId] = useState(initial.guardianId ?? "");
  const usingGuardian = Boolean(useGuardianId);

  return (
    <div>
      <h3 className="font-heading text-[16px] font-bold text-near-black">{title}</h3>
      <p className="mt-0.5 mb-3 font-body text-[13.5px] text-gray-dark">{helper}</p>

      {guardians.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {guardians.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-mid bg-white px-4 py-3 has-[:checked]:border-orange has-[:checked]:bg-orange/5"
            >
              <input
                type="checkbox"
                checked={useGuardianId === g.id}
                onChange={(e) => setUseGuardianId(e.target.checked ? g.id : "")}
                className="h-4 w-4 accent-orange"
              />
              <span className="font-body text-[14.5px] text-near-black">
                Use {g.name.split(" ")[0]} as {athleteFirstName}&rsquo;s {title.toLowerCase()}
              </span>
            </label>
          ))}
        </div>
      )}

      <input type="hidden" name={`${prefix}GuardianId`} value={useGuardianId} />

      {!usingGuardian && (
        <>
          <Question label="Name" error={errors[`${prefix}Name`]}>
            <TextInput name={`${prefix}Name`} defaultValue={initial.guardianId ? "" : initial.name} required />
          </Question>
          <div className="grid grid-cols-2 gap-3">
            <Question label="Relationship" error={errors[`${prefix}Relationship`]}>
              <TextInput
                name={`${prefix}Relationship`}
                defaultValue={initial.guardianId ? "" : initial.relationship}
                placeholder="Mom, Grandpa…"
                required
              />
            </Question>
            <Question label="Phone" error={errors[`${prefix}Phone`]}>
              <TextInput
                type="tel"
                name={`${prefix}Phone`}
                defaultValue={initial.guardianId ? "" : initial.phone}
                required
              />
            </Question>
          </div>
        </>
      )}
    </div>
  );
}

export default function FamilySafetyForm({
  athlete,
  displayName,
  guardians,
  nextHref,
}: {
  athlete: {
    id: string;
    hasMedicalInfo: boolean;
    medicalNotes: string | null;
    hasCustodyRestrictions: boolean;
    custodyRestrictions: string | null;
    emergencyContacts: { role: "primary" | "backup"; name: string; relationship: string; phone: string; guardianId: string | null }[];
  };
  displayName: string;
  guardians: Guardian[];
  nextHref: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveFamilySafety, { ok: false });
  const [hasMedical, setHasMedical] = useState<"yes" | "no" | null>(
    athlete.hasMedicalInfo ? "yes" : athlete.medicalNotes === null && !athlete.hasMedicalInfo ? null : "no"
  );
  const [hasCustody, setHasCustody] = useState<"yes" | "no" | null>(
    athlete.hasCustodyRestrictions ? "yes" : null
  );

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  const errors = state.errors ?? {};
  const primaryContact = athlete.emergencyContacts.find((c) => c.role === "primary");
  const backupContact = athlete.emergencyContacts.find((c) => c.role === "backup");
  const emptyContact: Contact = { name: "", relationship: "", phone: "", guardianId: null };

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />

      <section>
        <p className="mb-3 font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
          Health Information
        </p>
        <Question
          label={`Does ${displayName} have any medical conditions, allergies, medications, restrictions, or other health information we should know about while they're at The Courts?`}
        >
          <YesNo name="hasMedicalInfo" defaultValue={hasMedical} onChangeValue={setHasMedical} />
        </Question>
        {hasMedical === "yes" && (
          <Question label="Tell us what we need to know" error={errors.medicalNotes}>
            <TextArea
              name="medicalNotes"
              defaultValue={athlete.medicalNotes ?? ""}
              rows={4}
              placeholder="Allergies, medications, activity restrictions, medical conditions, or anything else that could affect participation or emergency care."
            />
            <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
              Only staff working with {displayName} can see this. It never appears on their Player
              Card, on team rosters, or in anything we publish.
            </p>
          </Question>
        )}
      </section>

      <div className="my-7 border-t border-gray-mid" />

      <section className="flex flex-col gap-6">
        <ContactSection
          prefix="primary"
          title="Primary Emergency Contact"
          helper="Who should we call first if there's an emergency?"
          guardians={guardians}
          athleteFirstName={displayName}
          initial={primaryContact ?? emptyContact}
          errors={errors}
        />
        <ContactSection
          prefix="backup"
          title="Backup Emergency Contact"
          helper="Who should we call if the primary contact can't be reached?"
          guardians={guardians}
          athleteFirstName={displayName}
          initial={backupContact ?? emptyContact}
          errors={errors}
        />
      </section>

      <div className="my-7 border-t border-gray-mid" />

      <section>
        <p className="mb-3 font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
          Pickup + Custody
        </p>
        <Question label={`Are there any custody, contact, or pickup restrictions we should know about for ${displayName}?`}>
          <YesNo name="hasCustodyRestrictions" defaultValue={hasCustody} onChangeValue={setHasCustody} />
        </Question>
        {hasCustody === "yes" && (
          <Question label="Tell us what we need to know" error={errors.custodyRestrictions}>
            <TextArea name="custodyRestrictions" defaultValue={athlete.custodyRestrictions ?? ""} rows={4} />
            <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
              Only our owner, admin and front-desk staff can see this. Coaches are given only the
              specific instruction they need at pickup — never the details.
            </p>
          </Question>
        )}
      </section>

      <div className="mt-7">
        <SubmitButton>Save Safety Information</SubmitButton>
      </div>
    </form>
  );
}
