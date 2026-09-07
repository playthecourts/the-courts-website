"use client";

import { useState } from "react";
import { revealEmergencyInfo } from "../../sessions/actions";

// Emergency contact, medical notes, and the pickup instruction.
//
// Coaches genuinely need these courtside, so access isn't blocked — but the
// values are never rendered into the page by default. They're fetched on an
// explicit tap, and that tap is written to the audit log server-side. Reading
// a child's medical information should be a deliberate act with a record, not
// something that happens by scrolling past it.
//
// What a coach can never reach from here: the family's custody or legal
// detail. If there is something they must act on, staff turn it into a single
// operational instruction, and that instruction is what shows up below.

type Revealed = Awaited<ReturnType<typeof revealEmergencyInfo>>;

export default function EmergencyInfo({ athleteId }: { athleteId: string }) {
  const [data, setData] = useState<Revealed | null>(null);
  const [loading, setLoading] = useState(false);

  if (data) {
    const contacts = data.contacts;
    return (
      <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3">
        <p className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
          Emergency Information
        </p>

        <dl className="mt-2 grid gap-2.5">
          <div>
            <dt className="font-sport text-[10px] font-bold uppercase tracking-wide text-danger">
              Emergency Contact
            </dt>
            <dd className="font-body text-sm text-near-black">
              {contacts.length > 0 ? (
                contacts.map((c) => (
                  <span key={`${c.name}-${c.phone}`} className="block">
                    {c.name} ({c.relationship}) ·{" "}
                    <a href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`} className="underline">
                      {c.phone}
                    </a>
                  </span>
                ))
              ) : (
                <>{data.legacyEmergencyContact || "Not on file — check with the front desk."}</>
              )}
            </dd>
          </div>

          <div>
            <dt className="font-sport text-[10px] font-bold uppercase tracking-wide text-danger">
              Medical Notes
            </dt>
            <dd className="font-body text-sm text-near-black">
              {data.medicalNotes || (data.hasMedicalInfo ? "Flagged — ask the front desk." : "None on file.")}
            </dd>
          </div>

          {data.pickupInstruction && (
            <div>
              <dt className="font-sport text-[10px] font-bold uppercase tracking-wide text-danger">
                At Pickup
              </dt>
              <dd className="font-body text-sm font-bold text-near-black">
                {data.pickupInstruction}
              </dd>
            </div>
          )}

          {data.authorizedPickups.length > 0 && (
            <div>
              <dt className="font-sport text-[10px] font-bold uppercase tracking-wide text-danger">
                Authorized Pickup
              </dt>
              <dd className="font-body text-sm text-near-black">
                {data.authorizedPickups.map((p) => `${p.name} (${p.relationship})`).join(" · ")}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-2 font-body text-[11px] text-danger">
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
      className="min-h-[48px] w-full rounded-xl border border-danger/40 bg-white px-4 font-sport text-[11px] font-bold uppercase tracking-wide text-danger hover:bg-danger-bg disabled:opacity-50"
    >
      {loading ? "Opening…" : "Show Emergency Info"}
    </button>
  );
}
