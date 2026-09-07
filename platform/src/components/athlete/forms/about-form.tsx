"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAbout, type ActionState } from "@/app/my-courts/athletes/actions";
import { COACHING_PREFERENCES, COMPETITIVE_METER, OTHER_SPORTS } from "@/lib/athlete";
import {
  StepHeader,
  Question,
  TextInput,
  TextArea,
  ChoiceChip,
  ChipRow,
  SubmitButton,
} from "@/components/athlete/form-ui";

// Step 2 — the part that makes this a profile rather than a registration.
//
// Every question here is optional and every one of them is answerable in a tap
// or a short phrase. Nothing asks the parent to understand a skill taxonomy;
// "ball handling, shooting, serving, confidence" as a placeholder does more
// than a dropdown of formal categories would.

export default function AboutForm({
  athlete,
  displayName,
  nextHref,
  eyebrow,
  title,
  sub,
  submitLabel = "Continue",
  sections = "all",
}: {
  athlete: {
    id: string;
    goal: string | null;
    coachingPreferences: string[];
    competitiveMeter: string | null;
    otherSports: string[];
    parentCoachNote: string | null;
  };
  displayName: string;
  nextHref: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
  submitLabel?: string;
  /// "all" during setup; the More tab splits this into About and Coaching so
  /// each screen stays short.
  sections?: "all" | "about" | "coaching";
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(saveAbout, { ok: false });
  const [otherSportOther, setOtherSportOther] = useState(
    athlete.otherSports.find((s) => !OTHER_SPORTS.includes(s)) ?? ""
  );

  useEffect(() => {
    if (state.ok) router.push(nextHref);
  }, [state, router, nextHref]);

  const showAbout = sections === "all" || sections === "about";
  const showCoaching = sections === "all" || sections === "coaching";

  return (
    <form action={formAction}>
      <input type="hidden" name="athleteId" value={athlete.id} />
      <StepHeader
        eyebrow={eyebrow}
        title={title ?? `A Little About ${displayName}`}
        sub={sub}
      />

      {showAbout && (
        <Question label="What do they want to get better at?" optional>
          <TextInput
            name="goal"
            defaultValue={athlete.goal ?? ""}
            placeholder="Ball handling, shooting, serving, confidence…"
          />
        </Question>
      )}

      {showCoaching && (
        <>
          <Question label="How do they like to be coached?" hint="Pick anything that sounds like them." optional>
            <ChipRow>
              {COACHING_PREFERENCES.map((p) => (
                <ChoiceChip
                  key={p.key}
                  name="coachingPreferences"
                  value={p.key}
                  label={p.label}
                  defaultChecked={athlete.coachingPreferences.includes(p.key)}
                />
              ))}
            </ChipRow>
          </Question>

          <Question
            label="Competitive Meter"
            hint="Just their personality — this is never a skill rating."
            optional
          >
            <ChipRow>
              {COMPETITIVE_METER.map((c) => (
                <ChoiceChip
                  key={c.key}
                  name="competitiveMeter"
                  type="radio"
                  value={c.key}
                  label={c.label}
                  defaultChecked={athlete.competitiveMeter === c.key}
                />
              ))}
            </ChipRow>
          </Question>
        </>
      )}

      {showAbout && (
        <>
          <Question label="Other sports they play" optional>
            <ChipRow>
              {OTHER_SPORTS.map((s) => (
                <ChoiceChip
                  key={s}
                  name="otherSports"
                  value={s}
                  label={s}
                  defaultChecked={athlete.otherSports.includes(s)}
                />
              ))}
            </ChipRow>
            <div className="mt-2.5">
              <TextInput
                name="otherSportsOther"
                value={otherSportOther}
                onChange={(e) => setOtherSportOther(e.target.value)}
                placeholder="Something else?"
              />
            </div>
          </Question>

          <Question
            label="Anything your coach should know to help them have a great session?"
            hint="Things like how they learn best, what motivates them, or anything that helps us coach them well."
            optional
          >
            <TextArea name="parentCoachNote" defaultValue={athlete.parentCoachNote ?? ""} rows={4} />
            <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
              Shared with {displayName}&rsquo;s coaches and our sport leads — never with other
              families. For allergies or medical needs, use the health question on the next step.
            </p>
          </Question>
        </>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
