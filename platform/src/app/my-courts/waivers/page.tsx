import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getWaiverCoverageSummaries } from "@/lib/waivers";
import { AthleteSignForm, FamilySignForm } from "./sign-form";
import PrivacyForm from "@/components/athlete/forms/privacy-form";
import { RELEASE_BODY, RELEASE_CHANNELS } from "@/lib/media-consent";
import Link from "next/link";

// Waivers + Permissions — the one place a family signs what's required and
// sets Photo/Video permission per athlete. Required acknowledgments and the
// optional permission are deliberately different UI: a waiver is signed once
// and stays signed (more athletes just need their own coverage over time); a
// permission is a preference that can change, and "No" is a complete answer,
// never an incomplete one.

const CANONICAL_ORDER = [
  "Participant Waiver & Release",
  "Emergency Medical Authorization",
  "Athlete Safety Acknowledgment",
  "Code of Conduct",
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

const BACK_LABELS: Record<string, string> = {
  "/my-courts/league": "Fall League",
  "/my-courts/explore": "Explore",
};

export default async function WaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string; back?: string }>;
}) {
  const { required, back } = await searchParams;
  const backHref = back && back.startsWith("/my-courts/") ? back : null;
  const backLabel = backHref ? (BACK_LABELS[backHref] ?? "where you were") : null;

  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const [summaries, mediaConsents] = await Promise.all([
    getWaiverCoverageSummaries(guardian.id, athleteIds),
    prisma.mediaConsent.findMany({ where: { athleteId: { in: athleteIds } } }),
  ]);

  const orderedRequired = summaries
    .filter((s) => s.waiver.required)
    .sort((a, b) => {
      const ai = CANONICAL_ORDER.indexOf(a.waiver.waiverType);
      const bi = CANONICAL_ORDER.indexOf(b.waiver.waiverType);
      return (ai === -1 ? CANONICAL_ORDER.length : ai) - (bi === -1 ? CANONICAL_ORDER.length : bi);
    });
  const optional = summaries.filter((s) => !s.waiver.required);

  // Page order is Code of Conduct, then Photo + Video Permission, then the
  // rest of the required waivers — not the canonical signing order above,
  // which only governs relative order within "the rest".
  const codeOfConduct = orderedRequired.find((s) => s.waiver.waiverType === "Code of Conduct");
  const remainingRequired = orderedRequired.filter((s) => s !== codeOfConduct);

  function athleteName(id: string) {
    const a = athletes.find((x) => x.id === id);
    return a ? `${a.firstName} ${a.lastName}` : "Athlete";
  }

  function renderRequiredWaiverCard(s: (typeof orderedRequired)[number]) {
    const isFullyCovered = s.uncoveredAthleteIds.size === 0;
    return (
      <div key={s.waiver.id} id={`waiver-${s.waiver.id}`} className="scroll-mt-6">
        {isFullyCovered ? (
          <div className="rounded-xl border border-gray-mid bg-white px-4 py-3.5">
            <p className="font-heading text-[15px] font-bold text-near-black">{s.waiver.waiverType}</p>
            <p className="mt-0.5 font-body text-[13px] text-gray-dark">
              &#10003; {s.waiver.scope === "family" ? "Signed" : "Acknowledged"}{" "}
              {s.mostRecentSignedAt ? formatDate(s.mostRecentSignedAt) : ""}
            </p>
            {s.waiver.scope === "family" && (
              <p className="mt-0.5 font-body text-[13px] text-gray-dark">
                Covers: {[...s.coveredAthleteIds].map(athleteName).join(", ")}
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                View &rarr;
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-light p-3 font-body text-xs text-gray-dark">
                {s.mostRecentAcceptedContent ?? s.waiver.content}
              </div>
            </details>
          </div>
        ) : (
          <div className="rounded-xl border border-orange/40 bg-orange/5 p-4">
            <p className="mb-1 font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
              Action Needed
            </p>
            <p className="mb-2 font-heading text-[16px] font-bold text-near-black">{s.waiver.waiverType}</p>
            <details className="mb-3">
              <summary className="cursor-pointer font-sport text-[11px] font-bold tracking-wide text-gray-dark uppercase">
                Read full text
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 font-body text-xs text-gray-dark">
                {s.waiver.content}
              </div>
            </details>
            {s.coveredAthleteIds.size > 0 && (
              <p className="mb-3 font-body text-xs text-gray-dark">
                Already covers: {[...s.coveredAthleteIds].map(athleteName).join(", ")}
              </p>
            )}
            {s.waiver.scope === "family" ? (
              <FamilySignForm
                waiverId={s.waiver.id}
                uncoveredAthletes={[...s.uncoveredAthleteIds].map((id) => ({ id, name: athleteName(id) }))}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {[...s.uncoveredAthleteIds].map((id) => (
                  <AthleteSignForm key={id} waiverId={s.waiver.id} athleteId={id} label={athleteName(id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Waivers + Permissions</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          Required forms are signed once and cover the athletes you select — add a new athlete later and
          you&rsquo;ll be asked to cover them too. Photo + Video Permission is a choice you can change anytime.
        </p>
      </div>

      {required && backHref && (
        <div className="rounded-lg border border-orange bg-orange/5 p-4 font-body text-sm text-neutral-800">
          Sign the waiver below to continue — once it&rsquo;s signed, head back to{" "}
          <Link href={backHref} className="font-semibold text-orange underline">
            {backLabel}
          </Link>{" "}
          to finish {required === "league" ? "registering" : "booking"}.
        </div>
      )}

      {athletes.length === 0 ? (
        <div className="rounded-xl border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">No Athletes Yet.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            Add an athlete to your family to sign waivers and set permissions.
          </p>
        </div>
      ) : (
        <>
          {codeOfConduct && (
            <section className="flex flex-col gap-4">
              {renderRequiredWaiverCard(codeOfConduct)}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
              Photo + Video Permission
            </p>
            {athletes.map((athlete) => {
              const consent = mediaConsents.find((mc) => mc.athleteId === athlete.id);
              return consent ? (
                <div key={athlete.id} className="rounded-xl border border-gray-mid bg-white px-4 py-3.5">
                  <p className="font-heading text-[15px] font-bold text-near-black">
                    {athlete.firstName} {athlete.lastName}
                  </p>
                  <p className="mt-0.5 font-body text-[13px] text-gray-dark">
                    &#10003; {consent.status === "media_ok" ? "Allowed" : "Not Allowed"}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-sport text-[11px] font-bold tracking-wide text-gray-dark uppercase">
                      Read full text
                    </summary>
                    <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-light p-3 font-body text-xs text-gray-dark">
                      {RELEASE_BODY.join("\n\n")}
                      {"\n\nChannels this may appear on:\n"}
                      {RELEASE_CHANNELS.map((c) => `• ${c}`).join("\n")}
                    </div>
                  </details>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                      Change &rarr;
                    </summary>
                    <div className="mt-3">
                      <PrivacyForm
                        athlete={{ id: athlete.id }}
                        displayName={`${athlete.firstName} ${athlete.lastName}`}
                        currentStatus={consent.status}
                        nextHref="/my-courts/waivers"
                      />
                    </div>
                  </details>
                </div>
              ) : (
                <div key={athlete.id} className="rounded-xl border border-orange/40 bg-orange/5 p-4">
                  <p className="mb-1 font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                    Action Needed
                  </p>
                  <p className="mb-3 font-heading text-[16px] font-bold text-near-black">
                    Photo + Video Permission — {athlete.firstName} {athlete.lastName}
                  </p>
                  <details className="mb-3">
                    <summary className="cursor-pointer font-sport text-[11px] font-bold tracking-wide text-gray-dark uppercase">
                      Read full text
                    </summary>
                    <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-3 font-body text-xs text-gray-dark">
                      {RELEASE_BODY.join("\n\n")}
                      {"\n\nChannels this may appear on:\n"}
                      {RELEASE_CHANNELS.map((c) => `• ${c}`).join("\n")}
                    </div>
                  </details>
                  <PrivacyForm
                    athlete={{ id: athlete.id }}
                    displayName={`${athlete.firstName} ${athlete.lastName}`}
                    currentStatus={null}
                    nextHref="/my-courts/waivers"
                  />
                </div>
              );
            })}
          </section>

          {remainingRequired.length > 0 && (
            <section className="flex flex-col gap-4">
              <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
                Required
              </p>
              {remainingRequired.map((s) => renderRequiredWaiverCard(s))}
            </section>
          )}

          {optional.length > 0 && (
            <section className="flex flex-col gap-4">
              <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
                Optional
              </p>
              {optional.map((s) => {
                const isFullyCovered = s.uncoveredAthleteIds.size === 0;
                return (
                  <div key={s.waiver.id} id={`waiver-${s.waiver.id}`} className="scroll-mt-6">
                    {isFullyCovered ? (
                      <div className="rounded-xl border border-gray-mid bg-white px-4 py-3.5">
                        <p className="font-heading text-[15px] font-bold text-near-black">
                          {s.waiver.waiverType} <span className="font-normal text-gray-dark">(optional)</span>
                        </p>
                        <p className="mt-0.5 font-body text-[13px] text-gray-dark">
                          &#10003; Signed {s.mostRecentSignedAt ? formatDate(s.mostRecentSignedAt) : ""}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-orange/40 bg-orange/5 p-4">
                        <p className="mb-1 font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                          Action Needed
                        </p>
                        <p className="mb-2 font-heading text-[15px] font-bold text-near-black">
                          {s.waiver.waiverType} <span className="font-normal text-gray-dark">(optional)</span>
                        </p>
                        {s.waiver.scope === "family" ? (
                          <FamilySignForm
                            waiverId={s.waiver.id}
                            uncoveredAthletes={[...s.uncoveredAthleteIds].map((id) => ({
                              id,
                              name: athleteName(id),
                            }))}
                          />
                        ) : (
                          <div className="flex flex-col gap-3">
                            {[...s.uncoveredAthleteIds].map((id) => (
                              <AthleteSignForm
                                key={id}
                                waiverId={s.waiver.id}
                                athleteId={id}
                                label={athleteName(id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}
