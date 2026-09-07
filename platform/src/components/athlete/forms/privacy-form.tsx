"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveMediaConsent, type ActionState } from "@/app/my-courts/athletes/actions";
import {
  PARENT_CHOICES,
  RELEASE_BODY,
  RELEASE_CHANNELS,
  RELEASE_VERSION,
  GUARDIAN_ACKNOWLEDGMENT,
  REVIEW_PENDING,
} from "@/lib/media-consent";
import {
  StepHeader,
  Question,
  TextInput,
  ChoiceCard,
  CardStack,
  SubmitButton,
} from "@/components/athlete/form-ui";

// Photos + video — its own screen, its own decision.
//
// Three things are deliberate here:
//
//   1. Nothing is preselected. The parent makes an affirmative choice, and a
//      form that arrives with "Yes" already filled in is not a choice.
//   2. The channels are listed by name. "Marketing purposes" is not something
//      a person can meaningfully agree to.
//   3. This is not the liability waiver and not the profile photo. A parent can
//      upload a photo so coaches recognise their kid AND choose No here, and
//      the two never affect each other.

export default function PrivacyForm({
  athlete,
  displayName,
  guardianName,
  currentStatus,
  currentRelationship,
  nextHref,
  eyebrow,
  submitLabel = "Save",
}: {
  athlete: { id: string };
  displayName: string;
  guardianName: string;
  currentStatus: string | null;
  currentRelationship: string | null;
  nextHref: string;
  eyebrow?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveMediaConsent, { ok: false });

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  const errors = state.errors ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />
      <StepHeader
        eyebrow={eyebrow}
        title="Photos + Video"
        sub="We love capturing what happens at The Courts. Let us know what you're comfortable with."
      />

      <Question label={`Can The Courts use photos or video of ${displayName}?`} error={errors.status}>
        <CardStack>
          {PARENT_CHOICES.map((c) => (
            <ChoiceCard
              key={c.status}
              name="status"
              value={c.status}
              headline={c.headline}
              detail={c.detail}
              // Only an existing saved answer preselects. A first-time parent
              // sees three empty options.
              defaultChecked={currentStatus === c.status}
            />
          ))}
        </CardStack>
      </Question>

      <div className="mb-6 rounded-xl border border-gray-mid bg-gray-light p-4">
        <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          What you&rsquo;re agreeing to
        </p>
        <p className="mb-2 font-body text-[13.5px] leading-relaxed text-near-black">
          If you say yes, approved photos and video may be used in:
        </p>
        <ul className="mb-3 list-disc pl-5 font-body text-[13.5px] leading-relaxed text-near-black">
          {RELEASE_CHANNELS.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {RELEASE_BODY.map((p) => (
          <p key={p} className="mb-2 font-body text-[13.5px] leading-relaxed text-gray-dark">
            {p}
          </p>
        ))}
        <p className="mt-3 font-body text-[12px] text-gray-dark">Release version {RELEASE_VERSION}</p>
        {REVIEW_PENDING && (
          // Shown to the parent, not hidden in a code comment: this text has not
          // been through counsel, and pretending otherwise would be the exact
          // kind of claim this project should never make.
          <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 font-body text-[12.5px] leading-snug text-warning">
            Draft wording — under review by The Courts. Your selection is saved and honored now;
            we&rsquo;ll ask you to confirm again if the wording changes.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Question label="Your Name" error={errors.guardianName}>
          <TextInput name="guardianName" defaultValue={guardianName} required />
        </Question>
        <Question label="Relationship" error={errors.relationship}>
          <TextInput
            name="relationship"
            defaultValue={currentRelationship ?? ""}
            placeholder="Mom, Dad…"
            required
          />
        </Question>
      </div>

      <div className="mb-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="acknowledged"
            value="yes"
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-orange)]"
          />
          <span className="font-body text-[14px] leading-snug text-near-black">
            {GUARDIAN_ACKNOWLEDGMENT}
          </span>
        </label>
        {errors.acknowledged && (
          <p role="alert" className="mt-1.5 font-body text-[13px] text-danger">
            {errors.acknowledged}
          </p>
        )}
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
      <p className="mt-3 text-center font-body text-[12.5px] text-gray-dark">
        You can change this any time. Choosing &ldquo;No&rdquo; never affects what {displayName} can
        take part in.
      </p>
    </form>
  );
}
