"use client";

import { useState } from "react";
import { saveCoachNote } from "../../sessions/actions";

// ---------------------------------------------------------------------------
// The note composer.
//
// The one thing this component exists to prevent: a coach accidentally
// publishing an internal observation to a parent. So:
//   - "Staff Only" is preselected, and stays selected on every reset.
//   - The two choices are rendered as equal-weight, clearly-labelled options
//     with different colors and explicit consequence text — not a subtle
//     toggle or a checkbox that could be missed.
//   - Choosing "Share with Parent" swaps the button label and shows a
//     confirmation line, so the destination is stated before the tap.
// The server independently defaults to staff_private (see saveCoachNote).
// ---------------------------------------------------------------------------

export default function NoteComposer({
  athleteId,
  sessionId,
  tags,
}: {
  athleteId: string;
  sessionId: string | null;
  tags: string[];
}) {
  const [shared, setShared] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-mid bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between px-4 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-near-black"
      >
        Add a Note
        <span aria-hidden="true" className="text-gray-dark">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <form
          action={async (formData) => {
            await saveCoachNote(sessionId, formData);
            setShared(false);
            setOpen(false);
          }}
          className="border-t border-gray-mid px-4 py-3"
        >
          <input type="hidden" name="athleteId" value={athleteId} />

          {tags.length > 0 && (
            <fieldset className="mb-3">
              <legend className="mb-1.5 font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                Quick Tags
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <label
                    key={tag}
                    className="cursor-pointer has-[:checked]:border-orange has-[:checked]:bg-orange has-[:checked]:text-white flex min-h-[40px] items-center rounded-full border border-gray-mid bg-white px-3 font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark"
                  >
                    <input type="checkbox" name="tags" value={tag} className="sr-only" />
                    {tag}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mb-3 grid gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                Focus
              </span>
              <input
                name="focus"
                placeholder="Finishing through contact"
                className="min-h-[44px] rounded-lg border border-gray-mid px-3 font-body text-sm focus:border-orange focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                Working On
              </span>
              <input
                name="workingOn"
                placeholder="Left-hand finishing, footwork"
                className="min-h-[44px] rounded-lg border border-gray-mid px-3 font-body text-sm focus:border-orange focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                Coach Note
              </span>
              <textarea
                name="body"
                rows={3}
                placeholder="Much more comfortable attacking left today."
                className="rounded-lg border border-gray-mid px-3 py-2 font-body text-sm focus:border-orange focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                Next Recommendation
              </span>
              <input
                name="nextRecommendation"
                placeholder="Finishing + Footwork Group Training"
                className="min-h-[44px] rounded-lg border border-gray-mid px-3 font-body text-sm focus:border-orange focus:outline-none"
              />
            </label>
          </div>

          <fieldset className="mb-3">
            <legend className="mb-1.5 font-sport text-[10px] font-bold uppercase tracking-wide text-gray-dark">
              Who can see this?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex min-h-[52px] cursor-pointer flex-col justify-center rounded-lg border-2 px-3 py-1.5 ${
                  !shared ? "border-charcoal bg-charcoal text-white" : "border-gray-mid bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="staff_private"
                  checked={!shared}
                  onChange={() => setShared(false)}
                  className="sr-only"
                />
                <span className="font-sport text-[11px] font-bold uppercase tracking-wide">
                  Staff Only
                </span>
                <span className={`font-body text-[11px] ${!shared ? "text-white/70" : "text-gray-dark"}`}>
                  Parents never see it
                </span>
              </label>
              <label
                className={`flex min-h-[52px] cursor-pointer flex-col justify-center rounded-lg border-2 px-3 py-1.5 ${
                  shared ? "border-orange bg-orange text-white" : "border-gray-mid bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="parent_shared"
                  checked={shared}
                  onChange={() => setShared(true)}
                  className="sr-only"
                />
                <span className="font-sport text-[11px] font-bold uppercase tracking-wide">
                  Share with Parent
                </span>
                <span className={`font-body text-[11px] ${shared ? "text-white/80" : "text-gray-dark"}`}>
                  Shows in the Parent App
                </span>
              </label>
            </div>
          </fieldset>

          {shared && (
            <p className="mb-3 rounded-lg border border-orange bg-orange/10 px-3 py-2 font-body text-xs text-near-black">
              This note will be visible to this athlete&apos;s parent or guardian in the Parent App.
              Write it as feedback for the family.
            </p>
          )}

          <button
            type="submit"
            className={`min-h-[48px] w-full rounded-lg font-heading text-sm font-bold uppercase tracking-wide text-white ${
              shared ? "bg-orange hover:bg-orange-hover" : "bg-charcoal hover:bg-near-black"
            }`}
          >
            {shared ? "Save & Share with Parent" : "Save Private Note"}
          </button>
        </form>
      )}
    </div>
  );
}
