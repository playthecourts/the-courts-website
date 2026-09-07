"use client";

import { useState, useTransition } from "react";
import { publishOffering, unpublishOffering, setOfferingStatus, updateVisibility } from "../actions";
import { formatCents } from "@/lib/programs/format";
import { Card, CardHeader, BTN, Pill, ErrorNote, SuccessNote } from "../../_components/ui";

// Publishing should never leave an admin wondering "did that actually show up
// in the Parent App?". The review below states exactly what goes live and
// where, and the sync panel afterwards states where it currently IS.

type Offering = {
  id: string;
  name: string;
  seasonLabel: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  priceCents: number | null;
  capacityTotal: number | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  stripePriceId: string | null;
  pricingModel: string;
  visibleParentApp: boolean;
  visibleWebsite: boolean;
  visibleCoachApp: boolean;
  internalOnly: boolean;
  publishedAt: string | null;
  sessions: { id: string; status: string; startTime: string; capacity: number; coaches: unknown[] }[];
};

type Readiness = {
  ready: boolean;
  blockers: { label: string; group: string }[];
  warnings: { label: string; group: string }[];
  sessionCount: number;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso))
    : null;

export function PublishSection({
  offering,
  readiness,
  programTypeLabel,
  grades,
  canPublish,
}: {
  offering: Offering;
  readiness: Readiness;
  programTypeLabel: string;
  grades: string | null;
  canPublish: boolean;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const scheduled = offering.sessions.filter((s) => s.status === "scheduled");
  const seats = scheduled.reduce((n, s) => n + s.capacity, 0);
  const dates =
    fmtDate(offering.startDate) && fmtDate(offering.endDate)
      ? `${fmtDate(offering.startDate)} – ${fmtDate(offering.endDate)}`
      : (fmtDate(offering.startDate) ?? "Not scheduled");

  const targets = offering.internalOnly
    ? ["Internal only — reaches no public surface"]
    : [
        offering.visibleParentApp ? "Parent App" : null,
        offering.visibleWebsite ? "Website" : null,
        offering.visibleCoachApp ? "Coach App" : null,
      ].filter(Boolean) as string[];

  const isLive = offering.status === "published";

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Publish targets" />
        <form
          className="p-4"
          action={async (fd) => {
            await updateVisibility(offering.id, fd);
            setMsg({ ok: true, text: "Publish targets updated." });
          }}
        >
          <div className="flex flex-col gap-2.5">
            {[
              { name: "visibleParentApp", label: "Parent App", detail: "Appears in Explore for eligible families.", checked: offering.visibleParentApp },
              { name: "visibleWebsite", label: "Website", detail: "Renders on playthecourts.com from this record — no HTML to edit.", checked: offering.visibleWebsite },
              { name: "visibleCoachApp", label: "Coach App", detail: "Assigned staff see it on their schedule automatically.", checked: offering.visibleCoachApp },
              { name: "internalOnly", label: "Internal only", detail: "Occupies the facility, reaches nobody. Staff practice, private bookings.", checked: offering.internalOnly },
            ].map((t) => (
              <label key={t.name} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-mid p-3 has-checked:border-orange has-checked:bg-orange/5">
                <input type="checkbox" name={t.name} defaultChecked={t.checked} disabled={!canPublish} className="mt-0.5" />
                <span className="text-sm">
                  <span className="os-heading block text-near-black">{t.label}</span>
                  <span className="text-gray-dark">{t.detail}</span>
                </span>
              </label>
            ))}
          </div>
          {canPublish ? (
            <button type="submit" className={`${BTN.secondary} mt-3`}>Save Targets</button>
          ) : null}
        </form>
      </Card>

      <Card>
        <CardHeader title="Review" />
        <div className="p-4">
          <p className="os-display text-xl text-near-black">
            {offering.name}
            {offering.seasonLabel ? <span className="ml-2 text-neutral">{offering.seasonLabel}</span> : null}
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Type", programTypeLabel],
              ["Dates", dates],
              ["Sessions", `${scheduled.length} scheduled`],
              ["Grades", grades ?? "All"],
              ["Seats", seats > 0 ? `${seats} across all sessions` : "—"],
              ["Price", offering.pricingModel === "free" ? "Free" : formatCents(offering.priceCents)],
              ["Registration", offering.registrationOpensAt ? `Opens ${fmtDate(offering.registrationOpensAt)}` : "Opens immediately"],
              ["Closes", offering.registrationClosesAt ? fmtDate(offering.registrationClosesAt)! : "No deadline"],
              ["Stripe", offering.pricingModel === "free" ? "Not needed" : offering.stripePriceId ? "Connected" : "Not connected"],
              ["Publishing to", targets.length ? targets.join(", ") : "Nowhere selected"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-gray-mid/60 py-1.5">
                <dt className="os-eyebrow text-neutral">{k}</dt>
                <dd className="text-right text-gray-dark">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4">
            {readiness.blockers.length > 0 ? (
              <div role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-3">
                <p className="os-eyebrow mb-1.5 text-danger">Can&apos;t publish yet</p>
                <ul className="flex flex-col gap-1 text-sm text-danger">
                  {readiness.blockers.map((b, i) => <li key={i}>· {b.label}</li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-success/30 bg-success-bg p-3">
                <p className="os-eyebrow text-success">Ready to publish</p>
                <p className="mt-1 text-sm text-success">No conflicts. Everything required is set.</p>
              </div>
            )}
          </div>

          {blockers ? (
            <div className="mt-3">
              <ErrorNote>
                <p className="mb-1">Publish stopped:</p>
                <ul>{blockers.map((b, i) => <li key={i}>· {b}</li>)}</ul>
              </ErrorNote>
            </div>
          ) : null}
          {msg ? (
            <div className="mt-3">{msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>}</div>
          ) : null}

          {canPublish ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {!isLive ? (
                <button
                  type="button"
                  disabled={pending || !readiness.ready}
                  onClick={() =>
                    start(async () => {
                      const r = await publishOffering(offering.id);
                      if (r.ok) { setMsg({ ok: true, text: "Published. It's live on the selected surfaces now." }); setBlockers(null); }
                      else setBlockers(r.blockers);
                    })
                  }
                  className={BTN.primary}
                >
                  {pending ? "Publishing…" : "Publish"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await unpublishOffering(offering.id, "Unpublished from builder");
                        setMsg({ ok: true, text: "Back to draft. It's no longer visible to families." });
                      })
                    }
                    className={BTN.secondary}
                  >
                    Unpublish
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => {
                      await setOfferingStatus(offering.id, "registration_closed");
                      setMsg({ ok: true, text: "Registration closed. It stays visible; nobody new can register." });
                    })}
                    className={BTN.secondary}
                  >
                    Close Registration
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  await setOfferingStatus(offering.id, "archived");
                  setMsg({ ok: true, text: "Archived. It stays in history and out of the working views." });
                })}
                className={BTN.ghost}
              >
                Archive
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral">Your role can view this but not publish.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Where this is right now" />
        <ul className="divide-y divide-gray-mid">
          {[
            { label: "Parent App", on: !offering.internalOnly && offering.visibleParentApp && isLive, note: "Explore, filtered to eligible athletes" },
            { label: "Website", on: !offering.internalOnly && offering.visibleWebsite && isLive, note: "playthecourts.com program cards" },
            { label: "Coach App", on: !offering.internalOnly && offering.visibleCoachApp && isLive, note: "Assigned staff schedules" },
          ].map((s) => (
            <li key={s.label} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="os-heading text-sm text-near-black">{s.label}</p>
                <p className="text-xs text-neutral">{s.note}</p>
              </div>
              <Pill tone={s.on ? "success" : "neutral"}>{s.on ? "Live" : "Not showing"}</Pill>
            </li>
          ))}
        </ul>
        {offering.publishedAt ? (
          <p className="border-t border-gray-mid px-4 py-2.5 text-xs text-neutral">
            Published {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(offering.publishedAt))}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
