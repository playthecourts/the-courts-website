"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAthlete, type ActionState } from "../actions";
import {
  StepHeader,
  Question,
  TextInput,
  Select,
  ChoiceChip,
  ChipRow,
  SubmitButton,
} from "@/components/athlete/form-ui";

// Step 1 of adding a child. Six questions, four of them one tap.
//
// The sport question is asked as Basketball / Volleyball / Both because that is
// how a parent thinks about it, and translated into the athlete's `sports`
// array on submit. Favorite Sport only appears if they picked Both, and is
// never required — plenty of kids genuinely don't have one.

const GRADES = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

export default function AddAthleteForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(createAthlete, { ok: false });
  const [sportChoice, setSportChoice] = useState<"Basketball" | "Volleyball" | "Both" | null>(null);

  useEffect(() => {
    if (state.ok && state.athleteId) {
      router.push(`/my-courts/athletes/${state.athleteId}/setup/photo`);
    }
  }, [state, router]);

  const errors = state.errors ?? {};

  return (
    <form action={formAction}>
      <StepHeader
        eyebrow="Step 1 of 4"
        title="Add an Athlete"
        sub="A few basics and they're on the roster."
      />

      <div className="grid grid-cols-2 gap-3">
        <Question label="First Name" error={errors.firstName}>
          <TextInput name="firstName" autoComplete="off" required />
        </Question>
        <Question label="Last Name" error={errors.lastName}>
          <TextInput name="lastName" autoComplete="off" required />
        </Question>
      </div>

      <Question label="Nickname" hint="What everyone actually calls them." optional>
        <TextInput name="nickname" autoComplete="off" />
      </Question>

      <Question
        label="Date of Birth"
        hint="We use this for age groups and to wish them a happy birthday month. We never show their full birthdate."
        error={errors.dob}
      >
        <TextInput type="date" name="dob" required />
      </Question>

      <Question label="Current Grade" error={errors.grade}>
        <Select name="grade" defaultValue="" required>
          <option value="" disabled>
            Select a grade
          </option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </Question>

      <Question label="School" optional>
        <TextInput name="school" autoComplete="off" />
      </Question>

      <Question label="Sport(s)" error={errors.sports}>
        <ChipRow>
          {(["Basketball", "Volleyball", "Both"] as const).map((choice) => (
            <label key={choice} className="cursor-pointer">
              <input
                type="radio"
                name="sportChoice"
                value={choice}
                checked={sportChoice === choice}
                onChange={() => setSportChoice(choice)}
                className="peer sr-only"
              />
              <span className="flex min-h-[46px] items-center rounded-full border border-gray-mid bg-white px-5 font-body text-[15px] text-near-black transition-colors peer-checked:border-orange peer-checked:bg-orange peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40">
                {choice}
              </span>
            </label>
          ))}
        </ChipRow>
        {/* The real submitted value — the tri-state choice above is UI. */}
        {(sportChoice === "Basketball" || sportChoice === "Both") && (
          <input type="hidden" name="sports" value="Basketball" />
        )}
        {(sportChoice === "Volleyball" || sportChoice === "Both") && (
          <input type="hidden" name="sports" value="Volleyball" />
        )}
      </Question>

      {sportChoice === "Both" && (
        <Question
          label="Favorite Sport"
          hint="Only if they have one — plenty of kids don't."
          optional
        >
          <ChipRow>
            <ChoiceChip name="favoriteSport" type="radio" value="Basketball" label="Basketball" />
            <ChoiceChip name="favoriteSport" type="radio" value="Volleyball" label="Volleyball" />
            <ChoiceChip name="favoriteSport" type="radio" value="Both" label="Both" />
          </ChipRow>
        </Question>
      )}

      <SubmitButton pendingLabel="Adding…">Continue</SubmitButton>
    </form>
  );
}
