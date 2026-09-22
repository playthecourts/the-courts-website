import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader, INPUT, SELECT } from "../_components/ui";
import { createLead, setLeadStage, addLeadNote, deleteLead } from "./actions";

export const dynamic = "force-dynamic";

// A pipeline board, one column per LeadStage — mirrors the Tasks board's
// shape (see ../tasks/page.tsx), but the columns are fixed to the real
// enum instead of free text, since a lead's stage is a real, meaningful
// progression rather than an arbitrary list name.

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "trial", label: "Trial Booked" },
  { key: "attended", label: "Attended" },
  { key: "follow_up", label: "Follow Up" },
  { key: "converted", label: "Converted" },
  { key: "not_now", label: "Not Now" },
] as const;

const SOURCES = [
  "website", "parent_referral", "coach_referral", "walk_in", "social",
  "nextgen_rollover", "camp", "league_evaluation", "event", "rental", "other",
];

const SOURCE_LABEL: Record<string, string> = {
  website: "Website", parent_referral: "Parent Referral", coach_referral: "Coach Referral",
  walk_in: "Walk-In", social: "Social", nextgen_rollover: "NextGen Rollover", camp: "Camp",
  league_evaluation: "League Eval", event: "Event", rental: "Rental", other: "Other",
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export default async function LeadsPage() {
  const actor = await requireCapability("leads.view");
  const canManage = can(actor, "leads.manage");

  const leads = await prisma.lead.findMany({
    include: { activities: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Courts OS"
        title="Leads"
        subtitle="Every inquiry, from first contact to converted (or not)."
      />

      {canManage && (
        <form action={createLead} className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-gray-mid bg-white p-3.5">
          <input name="name" placeholder="Name" required className={`${INPUT} min-h-9 w-40 text-sm`} />
          <input name="email" type="email" placeholder="Email" className={`${INPUT} min-h-9 w-52 text-sm`} />
          <input name="phone" placeholder="Phone" className={`${INPUT} min-h-9 w-36 text-sm`} />
          <input name="sport" placeholder="Sport" className={`${INPUT} min-h-9 w-32 text-sm`} />
          <select name="source" defaultValue="website" className={`${SELECT} min-h-9 w-40 text-sm`}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
            ))}
          </select>
          <input name="interest" placeholder="What are they interested in?" className={`${INPUT} min-h-9 flex-1 min-w-[200px] text-sm`} />
          <button className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-4 text-xs uppercase tracking-wide hover:border-near-black">
            Add Lead
          </button>
        </form>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(({ key, label }) => {
          const inStage = leads.filter((l) => l.stage === key);

          return (
            <div key={key} className="flex w-[300px] shrink-0 flex-col rounded-xl border border-gray-mid bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-gray-mid px-3.5 py-3">
                <h2 className="os-eyebrow text-gray-dark">{label}</h2>
                <span className="text-neutral">{inStage.length}</span>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {inStage.length === 0 && <p className="px-1 py-2 text-xs text-gray-dark">Nobody here.</p>}

                {inStage.map((l) => (
                  <div key={l.id} className="rounded-lg border border-gray-mid p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-near-black">{l.name}</p>
                      {canManage && (
                        <form action={deleteLead}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="shrink-0 text-xs text-gray-dark hover:text-danger" aria-label="Delete lead">
                            ✕
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {l.email && (
                        <a href={`mailto:${l.email}`} className="text-xs text-orange hover:underline">{l.email}</a>
                      )}
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="text-xs text-orange hover:underline">{l.phone}</a>
                      )}
                    </div>
                    {l.interest && <p className="mt-1.5 text-xs text-gray-dark">{l.interest}</p>}
                    {l.notes && <p className="mt-1 whitespace-pre-line text-xs text-gray-dark opacity-80">{l.notes}</p>}
                    {l.activities.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1 border-t border-gray-mid pt-1.5">
                        {l.activities.map((a) => (
                          <p key={a.id} className="text-[11px] text-gray-dark">
                            <span className="font-bold">{formatDate(a.createdAt)}:</span> {a.note}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-warm-stone px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                        {SOURCE_LABEL[l.source] ?? l.source}
                      </span>
                      {l.sport && (
                        <span className="rounded-full bg-warm-stone px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-dark">
                          {l.sport}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-dark">{formatDate(l.createdAt)}</span>
                    </div>
                    {canManage && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <form action={setLeadStage} className="flex items-center">
                          <input type="hidden" name="id" value={l.id} />
                          <select
                            name="stage"
                            defaultValue={l.stage}
                            onChange={(e) => e.currentTarget.form?.requestSubmit()}
                            className={`${SELECT} min-h-7 w-full text-[11px]`}
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>Move to: {s.label}</option>
                            ))}
                          </select>
                        </form>
                        <form action={addLeadNote} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={l.id} />
                          <input name="note" placeholder="Add a note…" className={`${INPUT} min-h-7 flex-1 text-[11px]`} />
                          <button className="os-heading min-h-7 rounded-lg border border-gray-mid bg-white px-2 text-[10px] uppercase tracking-wide hover:border-near-black">
                            Save
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
