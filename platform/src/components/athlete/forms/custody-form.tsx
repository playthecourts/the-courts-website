"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCustody, type ActionState } from "@/app/my-courts/athletes/actions";
import { Question, TextArea, YesNo, SubmitButton } from "@/components/athlete/form-ui";

// Custody / contact restrictions.
//
// Asked plainly, once, and stored apart from everything else because of who is
// allowed to read it: owner, admin and front desk. A coach never sees this text
// — if there is something a coach must act on, staff write a one-line
// instruction ("Do not release athlete to an unauthorized adult") that carries
// no legal or family detail with it.
//
// No document upload. The Courts has not built a workflow for holding custody
// paperwork, and asking for it without one would mean collecting court orders
// with nowhere safe to put them.

export default function CustodyForm({
  athlete,
  nextHref,
  submitLabel = "Save",
}: {
  athlete: { id: string; hasCustodyRestrictions: boolean; custodyRestrictions: string | null };
  nextHref: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveCustody, { ok: false });
  const [has, setHas] = useState<"yes" | "no" | null>(athlete.hasCustodyRestrictions ? "yes" : null);

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />

      <Question label="Are there any custody, contact, or pickup restrictions we need to be aware of?">
        <YesNo name="hasCustodyRestrictions" defaultValue={has} onChangeValue={setHas} />
      </Question>

      {has === "yes" && (
        <Question
          label="Please tell us what our staff needs to know."
          error={state.errors?.custodyRestrictions}
        >
          <TextArea name="custodyRestrictions" defaultValue={athlete.custodyRestrictions ?? ""} rows={4} />
          <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
            Only our owner, admin and front-desk staff can see this. Coaches are given only the
            specific instruction they need at pickup — never the details.
          </p>
        </Question>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
