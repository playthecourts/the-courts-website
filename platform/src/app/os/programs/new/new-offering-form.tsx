"use client";

import { useActionState, useState } from "react";
import { createOffering } from "../actions";
import { SPORTS } from "@/lib/programs/types";
import type { ProgramType } from "@/generated/prisma/enums";
import { Field, INPUT, SELECT, BTN, ErrorNote } from "../../_components/ui";

// Deliberately short. Six fields, most prefilled — enough to create the thing
// and land in the builder, where the rest is filled in with real context.
// A 40-field wall at creation time is how programs end up half-configured.

type ExistingProgram = {
  id: string;
  name: string;
  sport: string | null;
  _count: { offerings: number };
};

export function NewOfferingForm({
  programType,
  defaultSport,
  allowedSports,
  existingPrograms,
}: {
  programType: ProgramType;
  defaultSport: string | null;
  allowedSports: string[] | null;
  existingPrograms: ExistingProgram[];
}) {
  const [error, formAction, pending] = useActionState(async (_prev: string | null, fd: FormData) => {
    try {
      await createOffering(_prev, fd);
      return null;
    } catch (err) {
      // redirect() throws a control-flow signal Next re-throws itself; only a
      // real failure reaches the message branch.
      if (err && typeof err === "object" && "digest" in err) throw err;
      return err instanceof Error ? err.message : "Could not create that.";
    }
  }, null);

  const [mode, setMode] = useState<"new" | "existing">(
    existingPrograms.length > 0 ? "existing" : "new"
  );
  const sports = allowedSports && allowedSports.length > 0 ? allowedSports : [...SPORTS];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="programType" value={programType} />

      {existingPrograms.length > 0 ? (
        <fieldset>
          <legend className="os-eyebrow mb-2 text-gray-dark">Is this a new season of something we already run?</legend>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-mid p-3 has-checked:border-orange has-checked:bg-orange/5">
              <input
                type="radio"
                name="mode"
                value="existing"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="os-heading block text-near-black">Yes — new season</span>
                <span className="text-gray-dark">
                  Keeps the program definition and its history; adds a new season alongside it.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-mid p-3 has-checked:border-orange has-checked:bg-orange/5">
              <input
                type="radio"
                name="mode"
                value="new"
                checked={mode === "new"}
                onChange={() => setMode("new")}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="os-heading block text-near-black">No — brand new program</span>
                <span className="text-gray-dark">Something The Courts hasn&apos;t run before.</span>
              </span>
            </label>
          </div>
        </fieldset>
      ) : null}

      {mode === "existing" && existingPrograms.length > 0 ? (
        <Field label="Program" htmlFor="programId" required>
          <select id="programId" name="programId" className={SELECT} required>
            {existingPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.sport ? ` · ${p.sport}` : ""} ({p._count.offerings} season
                {p._count.offerings === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field
            label="Program name"
            htmlFor="programName"
            hint="The reusable definition — e.g. “Basketball Group Training”. Not the season."
            required
          >
            <input id="programName" name="programName" className={INPUT} required />
          </Field>
          <Field label="Sport" htmlFor="sport" required>
            <select id="sport" name="sport" defaultValue={defaultSport ?? ""} className={SELECT} required>
              <option value="" disabled>
                Choose a sport
              </option>
              {sports.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field
        label="Public name"
        htmlFor="name"
        hint="What families see. e.g. “3rd–5th Grade Basketball Group Training”."
        required
      >
        <input id="name" name="name" className={INPUT} required />
      </Field>

      <Field label="Season label" htmlFor="seasonLabel" hint="e.g. “Fall 2026”. Optional, but it's what tells two seasons apart later.">
        <input id="seasonLabel" name="seasonLabel" className={INPUT} placeholder="Fall 2026" />
      </Field>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN.primary}>
          {pending ? "Creating…" : "Create Draft"}
        </button>
        <p className="text-sm text-neutral">
          It starts as a draft. Nothing reaches families until you publish.
        </p>
      </div>
    </form>
  );
}
