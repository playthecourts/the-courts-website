"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveMediaConsent, type ActionState } from "@/app/my-courts/athletes/actions";
import { RELEASE_BODY, RELEASE_CHANNELS } from "@/lib/media-consent";
import { StepHeader } from "@/components/athlete/form-ui";

// Photo + Video Permission — a consent choice, not a profile field. Lives
// under Waivers & Releases / Action Needed and under My Athletes > Privacy +
// Permissions, never inside athlete profile setup: it doesn't help a coach
// personalize training, so it doesn't belong with the information that does.
//
// Two things are deliberate here:
//
//   1. Nothing is preselected, and there is no separate acknowledgment
//      checkbox on top of the two choices — clicking one of them IS the
//      explicit, unambiguous decision.
//   2. The channels are listed by name. "Marketing purposes" is not
//      something a person can meaningfully agree to.

export default function PrivacyForm({
  athlete,
  displayName,
  currentStatus,
  nextHref,
  eyebrow,
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

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />
      <StepHeader
        eyebrow={eyebrow}
        title="Photo + Video Permission"
        sub={`Choose whether The Courts may use approved photos or video of ${displayName} in our own marketing channels.`}
      />

      <div className="mb-6 rounded-xl border border-gray-mid bg-gray-light p-4">
        <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          What this includes
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
          <p key={p} className="mb-2 font-body text-[13.5px] leading-relaxed text-gray-dark last:mb-0">
            {p}
          </p>
        ))}
      </div>

      {state.errors?.status && (
        <p role="alert" className="mb-3 font-body text-[13.5px] text-danger">
          {state.errors.status}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="submit"
          name="status"
          value="media_ok"
          className={`min-h-14 rounded-xl border-2 font-sport text-[13px] font-bold tracking-wide uppercase transition-colors ${
            currentStatus === "media_ok"
              ? "border-orange bg-orange text-white"
              : "border-gray-mid bg-white text-near-black hover:border-orange"
          }`}
        >
          Yes, I Give Permission
        </button>
        <button
          type="submit"
          name="status"
          value="media_no"
          className={`min-h-14 rounded-xl border-2 font-sport text-[13px] font-bold tracking-wide uppercase transition-colors ${
            currentStatus === "media_no"
              ? "border-near-black bg-near-black text-white"
              : "border-gray-mid bg-white text-near-black hover:border-near-black"
          }`}
        >
          No, I Do Not Give Permission
        </button>
      </div>

      <p className="mt-4 text-center font-body text-[12.5px] text-gray-dark">
        You can change this choice at any time.
      </p>
    </form>
  );
}
