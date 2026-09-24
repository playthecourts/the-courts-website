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
// Sport(s) is a real multi-select, not a tri-state Basketball/Volleyball/Both
// choice — "Performance Training" covers a kid who does Speed + Agility or
// Performance Lab without necessarily playing Basketball or Volleyball, same
// label already used for those cross-sport offerings on the schedule.
// Favorite Sport only appears once 2+ are picked, and is never required —
// plenty of kids genuinely don't have one.

const GRADES = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const SPORT_OPTIONS = ["Basketball", "Volleyball", "Performance Training"] as const;

export default function AddAthleteForm() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(createAthlete, { ok: false });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok && state.athleteId) {
      // Setup lives OUTSIDE /athletes/[id] so it doesn't inherit the profile
      // layout's tabs and "finish your profile" nudge mid-flow.
      router.push(`/my-courts/athletes/setup/${state.athleteId}/photo`);
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

      <Question label="Sport(s)" hint="Pick any that apply." error={errors.sports}>
        <ChipRow>
          {SPORT_OPTIONS.map((choice) => {
            const checked = selectedSports.includes(choice);
            return (
              <label key={choice} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="sports"
                  value={choice}
                  checked={checked}
                  onChange={() =>
                    setSelectedSports((prev) =>
                      checked ? prev.filter((s) => s !== choice) : [...prev, choice]
                    )
                  }
                  className="peer sr-only"
                />
                <span className="flex min-h-[46px] items-center rounded-full border border-gray-mid bg-white px-5 font-body text-[15px] text-near-black transition-colors peer-checked:border-orange peer-checked:bg-orange peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40">
                  {choice}
                </span>
              </label>
            );
          })}
        </ChipRow>
      </Question>

      {selectedSports.length > 1 && (
        <Question
          label="Favorite Sport"
          hint="Only if they have one — plenty of kids don't."
          optional
        >
          <ChipRow>
            {selectedSports.map((sport) => (
              <ChoiceChip key={sport} name="favoriteSport" type="radio" value={sport} label={sport} />
            ))}
          </ChipRow>
        </Question>
      )}

      <SubmitButton pendingLabel="Adding…">Continue</SubmitButton>
    </form>
  );
}
