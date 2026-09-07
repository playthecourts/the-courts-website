"use client";

import { useActionState } from "react";
import { updateOfferingDetails, updateVisibility } from "../actions";
import { GRADES, SKILL_LEVEL_LABELS, type FieldGroup } from "@/lib/programs/types";
import { Card, CardHeader, Field, INPUT, SELECT, TEXTAREA, BTN, ErrorNote, SuccessNote } from "../../_components/ui";

// Progressive disclosure in practice: every section below is wrapped in a
// `groups.includes(...)` check driven by the program type registry. A court
// rental never renders eligibility; a Dr. Dish session never renders league
// settings. Nothing is hidden with CSS — it isn't rendered at all.

type Offering = {
  id: string;
  name: string;
  internalName: string | null;
  seasonLabel: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  parentInstructions: string | null;
  coachNotes: string | null;
  internalNotes: string | null;
  whatToBring: string[];
  websiteCta: string | null;
  imageUrl: string | null;
  imageAltText: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: string | null;
  skillLevel: string | null;
  inviteOnly: boolean;
  requiresTrainingPlan: boolean;
  eligibilityNote: string | null;
  capacityTotal: number | null;
  defaultSessionCapacity: number | null;
  lowSpotThreshold: number;
  waitlistMode: string;
  waitlistOfferHours: number;
  registrationMode: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  closeWhenFull: boolean;
  allowSingleDay: boolean;
  externalLocationName: string | null;
  externalLocationAddress: string | null;
  leagueStage: string | null;
  startDate: string | null;
  endDate: string | null;
  visibleParentApp: boolean;
  visibleWebsite: boolean;
  visibleCoachApp: boolean;
  internalOnly: boolean;
};

function dtLocal(iso: string | null) {
  return iso ? iso.slice(0, 16) : "";
}

export function DetailsSection({
  offering,
  groups,
  canEdit,
  waivers,
}: {
  offering: Offering;
  groups: FieldGroup[];
  canEdit: boolean;
  waivers: { id: string; waiverType: string; version: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok?: boolean; error?: string } | null, fd: FormData) => {
      try {
        await updateOfferingDetails(offering.id, fd);
        return { ok: true };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not save." };
      }
    },
    null
  );

  const has = (g: FieldGroup) => groups.includes(g);
  const ro = !canEdit;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Basics" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Public name" htmlFor="name" hint="What families see." required>
            <input id="name" name="name" defaultValue={offering.name} className={INPUT} disabled={ro} required />
          </Field>
          <Field label="Internal name" htmlFor="internalName" hint="Only staff see this.">
            <input id="internalName" name="internalName" defaultValue={offering.internalName ?? ""} className={INPUT} disabled={ro} />
          </Field>
          <Field label="Season" htmlFor="seasonLabel" hint="Fall 2026, Winter 2027…">
            <input id="seasonLabel" name="seasonLabel" defaultValue={offering.seasonLabel ?? ""} className={INPUT} disabled={ro} />
          </Field>
        </div>
      </Card>

      {has("eligibility") ? (
        <Card>
          <CardHeader title="Who it's for" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Grade from" htmlFor="gradeMin" hint="Grade is easier than age for families and admins alike.">
              <select id="gradeMin" name="gradeMin" defaultValue={offering.gradeMin ?? ""} className={SELECT} disabled={ro}>
                <option value="">Any</option>
                {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Grade to" htmlFor="gradeMax">
              <select id="gradeMax" name="gradeMax" defaultValue={offering.gradeMax ?? ""} className={SELECT} disabled={ro}>
                <option value="">Any</option>
                {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Age min" htmlFor="ageMin" hint="Only where age genuinely matters.">
              <input id="ageMin" name="ageMin" type="number" min="0" max="99" defaultValue={offering.ageMin ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Age max" htmlFor="ageMax">
              <input id="ageMax" name="ageMax" type="number" min="0" max="99" defaultValue={offering.ageMax ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Gender" htmlFor="gender" hint="Leave as Any unless it genuinely gates participation.">
              <select id="gender" name="gender" defaultValue={offering.gender ?? ""} className={SELECT} disabled={ro}>
                <option value="">Any</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
              </select>
            </Field>
            {has("skill_level") ? (
              <Field label="Skill level" htmlFor="skillLevel">
                <select id="skillLevel" name="skillLevel" defaultValue={offering.skillLevel ?? ""} className={SELECT} disabled={ro}>
                  <option value="">Not specified</option>
                  {Object.entries(SKILL_LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            ) : null}
            <div className="sm:col-span-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresTrainingPlan" defaultChecked={offering.requiresTrainingPlan} disabled={ro} />
                Requires an active Training Plan to register
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="inviteOnly" defaultChecked={offering.inviteOnly} disabled={ro} />
                Invitation only
              </label>
            </div>
            <Field label="Eligibility note" htmlFor="eligibilityNote" hint="Shown to families alongside the grade range.">
              <input id="eligibilityNote" name="eligibilityNote" defaultValue={offering.eligibilityNote ?? ""} className={INPUT} disabled={ro} />
            </Field>
          </div>
        </Card>
      ) : null}

      {has("capacity") ? (
        <Card>
          <CardHeader title="Capacity + waitlist" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Capacity per session" htmlFor="defaultSessionCapacity">
              <input id="defaultSessionCapacity" name="defaultSessionCapacity" type="number" min="1" defaultValue={offering.defaultSessionCapacity ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Whole-offering capacity" htmlFor="capacityTotal" hint="A camp that sells 40 seats across all days. Leave blank to track per session.">
              <input id="capacityTotal" name="capacityTotal" type="number" min="1" defaultValue={offering.capacityTotal ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="“Few spots left” at" htmlFor="lowSpotThreshold" hint="Shown to families only when the real number of seats is this low.">
              <input id="lowSpotThreshold" name="lowSpotThreshold" type="number" min="0" defaultValue={offering.lowSpotThreshold} className={INPUT} disabled={ro} />
            </Field>
            {has("waitlist") ? (
              <>
                <Field label="Waitlist" htmlFor="waitlistMode">
                  <select id="waitlistMode" name="waitlistMode" defaultValue={offering.waitlistMode} className={SELECT} disabled={ro}>
                    <option value="none">No waitlist</option>
                    <option value="automatic">Families can join</option>
                    <option value="manual">Admin adds families</option>
                  </select>
                </Field>
                <Field label="Offer expires after (hours)" htmlFor="waitlistOfferHours" hint="A freed seat is offered to the next family and held this long. Nobody is charged automatically.">
                  <input id="waitlistOfferHours" name="waitlistOfferHours" type="number" min="1" defaultValue={offering.waitlistOfferHours} className={INPUT} disabled={ro} />
                </Field>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      {has("registration") ? (
        <Card>
          <CardHeader title="Registration" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="What families register for" htmlFor="registrationMode">
              <select id="registrationMode" name="registrationMode" defaultValue={offering.registrationMode} className={SELECT} disabled={ro}>
                <option value="session">Individual sessions</option>
                <option value="offering">The whole thing</option>
                <option value="multi_day">Whole run, or single days</option>
                <option value="season">The season</option>
              </select>
            </Field>
            {has("camp") ? (
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-3 text-sm">
                  <input type="checkbox" name="allowSingleDay" defaultChecked={offering.allowSingleDay} disabled={ro} />
                  Allow single-day registration
                </label>
              </div>
            ) : null}
            <Field label="Registration opens" htmlFor="registrationOpensAt" hint="Leave blank to open immediately.">
              <input id="registrationOpensAt" name="registrationOpensAt" type="datetime-local" defaultValue={dtLocal(offering.registrationOpensAt)} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Registration closes" htmlFor="registrationClosesAt">
              <input id="registrationClosesAt" name="registrationClosesAt" type="datetime-local" defaultValue={dtLocal(offering.registrationClosesAt)} className={INPUT} disabled={ro} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="closeWhenFull" defaultChecked={offering.closeWhenFull} disabled={ro} />
              Close registration when full
            </label>
          </div>
        </Card>
      ) : null}

      {has("league") ? (
        <Card>
          <CardHeader title="Season" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="League stage" htmlFor="leagueStage">
              <select id="leagueStage" name="leagueStage" defaultValue={offering.leagueStage ?? ""} className={SELECT} disabled={ro}>
                <option value="">Not started</option>
                {["interest","evaluation","evaluation_complete","registration","team_placement","season","tournament","complete"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Season starts" htmlFor="startDate">
              <input id="startDate" name="startDate" type="date" defaultValue={offering.startDate?.slice(0, 10) ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Season ends" htmlFor="endDate">
              <input id="endDate" name="endDate" type="date" defaultValue={offering.endDate?.slice(0, 10) ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="External location" htmlFor="externalLocationName" hint="Away games. Leave blank for The Courts.">
              <input id="externalLocationName" name="externalLocationName" defaultValue={offering.externalLocationName ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Address" htmlFor="externalLocationAddress">
              <input id="externalLocationAddress" name="externalLocationAddress" defaultValue={offering.externalLocationAddress ?? ""} className={INPUT} disabled={ro} />
            </Field>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Copy" />
        <div className="grid gap-4 p-4">
          <Field label="Short card copy" htmlFor="shortDescription" hint="One or two lines. This is the Parent App card and the website tile — not the full description." required>
            <textarea id="shortDescription" name="shortDescription" rows={2} defaultValue={offering.shortDescription ?? ""} className={TEXTAREA} disabled={ro} />
          </Field>
          <Field label="Full description" htmlFor="fullDescription" hint="The long version, for the website and the detail page.">
            <textarea id="fullDescription" name="fullDescription" rows={5} defaultValue={offering.fullDescription ?? ""} className={TEXTAREA} disabled={ro} />
          </Field>
          <Field label="What to bring" htmlFor="whatToBring" hint="One per line. Only what you enter is shown.">
            <textarea id="whatToBring" name="whatToBring" rows={3} defaultValue={offering.whatToBring.join("\n")} className={TEXTAREA} disabled={ro} placeholder={"Water bottle\nBasketball shoes"} />
          </Field>
          <Field label="Parent instructions" htmlFor="parentInstructions" hint="Logistics families need on the day. Parent-facing.">
            <textarea id="parentInstructions" name="parentInstructions" rows={2} defaultValue={offering.parentInstructions ?? ""} className={TEXTAREA} disabled={ro} />
          </Field>
          <Field label="Coach notes" htmlFor="coachNotes" hint="Coach App only. Never shown to families.">
            <textarea id="coachNotes" name="coachNotes" rows={2} defaultValue={offering.coachNotes ?? ""} className={TEXTAREA} disabled={ro} />
          </Field>
          <Field label="Internal notes" htmlFor="internalNotes" hint="Courts OS only. Never leaves this screen.">
            <textarea id="internalNotes" name="internalNotes" rows={2} defaultValue={offering.internalNotes ?? ""} className={TEXTAREA} disabled={ro} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Featured image URL" htmlFor="imageUrl" hint="Leave blank to use the branded fallback.">
              <input id="imageUrl" name="imageUrl" defaultValue={offering.imageUrl ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Image alt text" htmlFor="imageAltText" hint="Describes the image for screen readers.">
              <input id="imageAltText" name="imageAltText" defaultValue={offering.imageAltText ?? ""} className={INPUT} disabled={ro} />
            </Field>
            <Field label="Website CTA" htmlFor="websiteCta" hint="Button label on the marketing site.">
              <input id="websiteCta" name="websiteCta" defaultValue={offering.websiteCta ?? ""} className={INPUT} disabled={ro} placeholder="Register" />
            </Field>
          </div>
        </div>
      </Card>

      {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state?.ok ? <SuccessNote>Saved.</SuccessNote> : null}

      {canEdit ? (
        <div className="sticky bottom-4 flex justify-end">
          <button type="submit" disabled={pending} className={`${BTN.primary} shadow-lg`}>
            {pending ? "Saving…" : "Save Details"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral">Your role can view this but not edit it.</p>
      )}
    </form>
  );
}
