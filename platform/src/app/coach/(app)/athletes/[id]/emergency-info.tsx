"use client";

import { useState } from "react";
import { revealEmergencyInfo } from "../../sessions/actions";

// Emergency contact and medical notes.
//
// Coaches genuinely need these courtside, so access isn't blocked — but the
// values are never rendered into the page by default. They're fetched on an
// explicit tap, and that tap is written to the audit log server-side. The
// point is that reading a child's medical information is a deliberate act
// with a record, not something that happens by scrolling past it.
export default function EmergencyInfo({ athleteId }: { athleteId: string }) {
  const [data, setData] = useState<{
    emergencyContact: string | null;
    medicalNotes: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  if (data) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
        <p className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-red-800">
          Emergency Information
        </p>
        <dl className="mt-2 grid gap-2">
          <div>
            <dt className="font-sport text-[10px] font-bold uppercase text-red-900">
              Emergency Contact
            </dt>
            <dd className="font-body text-sm text-near-black">
              {data.emergencyContact || "Not on file — check with the front desk."}
            </dd>
          </div>
          <div>
            <dt className="font-sport text-[10px] font-bold uppercase text-red-900">Medical Notes</dt>
            <dd className="font-body text-sm text-near-black">
              {data.medicalNotes || "None on file."}
            </dd>
          </div>
        </dl>
        <p className="mt-2 font-body text-[11px] text-red-900">
          This view was recorded in the staff audit log.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          setData(await revealEmergencyInfo(athleteId));
        } finally {
          setLoading(false);
        }
      }}
      className="min-h-[48px] w-full rounded-xl border border-red-300 bg-white px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-red-800 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "Opening…" : "Show Emergency Info"}
    </button>
  );
}
