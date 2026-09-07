import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { listMediaPermissions, openMediaFollowUps, canSeeConsentDetail, offeringMediaRoster } from "@/lib/media-roster";
import { staffMediaLabel, RELEASE_VERSION, REVIEW_PENDING } from "@/lib/media-consent";
import { PageHeader, Card, CardHeader, EmptyState, Pill, TableWrap, Th, Td, type Tone } from "../_components/ui";

export const dynamic = "force-dynamic";

// Internal only. This page answers "who can we photograph?" before a camera
// comes out — it is never a public roster, and media status is never shown to
// another family.

const TONE: Record<string, Tone> = {
  media_ok: "success",
  media_limited: "warning",
  media_no: "danger",
  unanswered: "neutral",
};

const FILTERS = [
  { key: "", label: "Everyone" },
  { key: "media_ok", label: "Media OK" },
  { key: "media_limited", label: "Ask First" },
  { key: "media_no", label: "No Media" },
  { key: "unanswered", label: "Not Answered" },
] as const;

export default async function MediaPage({ searchParams }: PageProps<"/os/media">) {
  // Gated on the narrow capability, not athletes.view: Marketing must be able
  // to check who it may photograph without being handed a database of children.
  // Consent DETAIL (who agreed, when, which release) stays behind
  // families.viewSensitive — see canSeeConsentDetail below.
  const actor = await requireCapability("athletes.viewMediaStatus");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const offeringId = typeof sp.offering === "string" ? sp.offering : null;

  const showDetail = canSeeConsentDetail(actor);

  const [athletes, followUps, upcomingOfferings, roster] = await Promise.all([
    listMediaPermissions(actor, { status, q }),
    showDetail ? openMediaFollowUps() : Promise.resolve([]),
    prisma.offering.findMany({
      where: { status: "published", sessions: { some: { startTime: { gte: new Date() } } } },
      orderBy: { startDate: "asc" },
      take: 20,
      select: { id: true, name: true, seasonLabel: true },
    }),
    offeringId ? offeringMediaRoster(offeringId) : Promise.resolve(null),
  ]);

  const counts = {
    ok: athletes.filter((a) => a.mediaConsent?.status === "media_ok").length,
    limited: athletes.filter((a) => a.mediaConsent?.status === "media_limited").length,
    no: athletes.filter((a) => a.mediaConsent?.status === "media_no").length,
    unanswered: athletes.filter((a) => !a.mediaConsent).length,
  };

  const selectedOffering = upcomingOfferings.find((o) => o.id === offeringId);

  function href(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q, offering: offeringId ?? undefined, ...next })) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return `/os/media${s ? `?${s}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Internal"
        title="Photos + Video"
        subtitle="Who we can photograph, and who we need to check with first. Never shown to families."
      />

      {REVIEW_PENDING ? (
        <div role="alert" className="mb-5 rounded-xl border border-warning/30 bg-warning-bg p-4">
          <p className="os-eyebrow mb-1 text-warning">Needs legal review</p>
          <p className="text-sm text-warning">
            Release <span className="os-num">{RELEASE_VERSION}</span> is draft language written for
            this build. It has not been reviewed by an attorney and should not be relied on in
            production until an owner or counsel approves it.
          </p>
        </div>
      ) : null}

      {/* Pre-shoot roster for one offering — the "Fall Break Camp" view. */}
      <Card className="mb-5">
        <CardHeader title="Before a shoot" />
        <div className="p-4">
          <form method="get" action="/os/media" className="flex flex-wrap items-end gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <div>
              <label htmlFor="offering" className="os-eyebrow mb-1.5 block text-gray-dark">
                Check a program&apos;s roster
              </label>
              <select
                id="offering"
                name="offering"
                defaultValue={offeringId ?? ""}
                className="min-h-11 min-w-64 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
              >
                <option value="">Choose a program…</option>
                {upcomingOfferings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}{o.seasonLabel ? ` · ${o.seasonLabel}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
              Show Roster
            </button>
          </form>

          {roster && selectedOffering ? (
            <div className="mt-4 rounded-lg border border-gray-mid bg-warm-white p-4">
              <p className="os-heading text-sm text-near-black">{selectedOffering.name}</p>
              <p className="os-num mt-1 text-sm text-gray-dark">
                {roster.total} athlete{roster.total === 1 ? "" : "s"} · {roster.ok} Media OK ·{" "}
                {roster.askFirst} Ask First · {roster.no} No Media
                {roster.unanswered > 0 ? ` · ${roster.unanswered} Not Answered` : ""}
              </p>

              {roster.attention.length > 0 ? (
                <div className="mt-3">
                  <p className="os-eyebrow mb-2 text-warning">
                    Check before photographing ({roster.attention.length})
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {roster.attention.map((e) => (
                      <li key={e.athleteId}>
                        <Pill tone={TONE[e.status ?? "unanswered"]}>
                          {e.firstName} {e.lastName.charAt(0)}. · {e.label}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-neutral">
                    A group photo does not override anyone&apos;s choice. Not answered is treated as
                    ask first.
                  </p>
                </div>
              ) : roster.total > 0 ? (
                <p className="mt-2 text-sm text-success">
                  Everyone on this roster is Media OK.
                </p>
              ) : (
                <p className="mt-2 text-sm text-neutral">Nobody is booked into this program yet.</p>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      {showDetail && followUps.length > 0 ? (
        <Card className="mb-5">
          <CardHeader title="Withdrawals needing review" count={followUps.length} />
          <ul className="divide-y divide-gray-mid">
            {followUps.map((f) => (
              <li key={f.id} className="px-4 py-3">
                <p className="os-heading text-sm text-near-black">
                  {f.athlete.firstName} {f.athlete.lastName}
                </p>
                <p className="text-xs text-neutral">
                  {staffMediaLabel(f.oldStatus)} → {staffMediaLabel(f.newStatus)}
                  {f.guardian ? ` · ${f.guardian.name}` : ""} ·{" "}
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(f.createdAt)}
                </p>
                <p className="mt-1 text-xs text-warning">
                  Review material already published. Nothing is removed automatically.
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ["Media OK", counts.ok, "media_ok"],
          ["Ask First", counts.limited, "media_limited"],
          ["No Media", counts.no, "media_no"],
          ["Not Answered", counts.unanswered, "unanswered"],
        ].map(([label, n, key]) => (
          <Link
            key={key as string}
            href={href({ status: key as string })}
            className={`rounded-xl border bg-white p-4 transition-colors hover:border-near-black ${
              status === key ? "border-near-black" : "border-gray-mid"
            }`}
          >
            <p className="os-eyebrow text-neutral">{label as string}</p>
            <p className="os-display os-num mt-1.5 text-2xl text-near-black">{n as number}</p>
          </Link>
        ))}
      </div>

      <form method="get" action="/os/media" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="q" className="os-eyebrow mb-1.5 block text-gray-dark">Search</label>
          <input
            id="q" name="q" defaultValue={q} placeholder="Athlete name…"
            className="min-h-11 w-56 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 self-end">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ status: f.key || undefined })}
              className={`os-eyebrow inline-flex min-h-11 items-center rounded-full border px-3 ${
                status === f.key
                  ? "border-near-black bg-near-black text-white"
                  : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      <Card>
        <CardHeader title="Athletes" count={athletes.length} />
        {athletes.length === 0 ? (
          <EmptyState headline="Nobody matches." detail="Try another status or clear the search." />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>Grade</Th>
                  <Th>Status</Th>
                  {showDetail ? <Th>Consented by</Th> : null}
                  {showDetail ? <Th>Date</Th> : null}
                  {showDetail ? <Th>Release</Th> : null}
                </tr>
              </thead>
              <tbody>
                {athletes.map((a) => {
                  const st = a.mediaConsent?.status ?? null;
                  return (
                    <tr key={a.id}>
                      <Td>{a.firstName} {a.lastName}</Td>
                      <Td className="text-neutral">{a.grade ?? "—"}</Td>
                      <Td>
                        <Pill tone={TONE[st ?? "unanswered"]}>{staffMediaLabel(st)}</Pill>
                      </Td>
                      {showDetail ? (
                        <Td className="text-neutral">
                          {a.mediaConsent
                            ? `${a.mediaConsent.guardianName} (${a.mediaConsent.guardianRelationship})`
                            : "—"}
                        </Td>
                      ) : null}
                      {showDetail ? (
                        <Td className="os-num text-neutral">
                          {a.mediaConsent
                            ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(a.mediaConsent.consentDate)
                            : "—"}
                        </Td>
                      ) : null}
                      {showDetail ? (
                        <Td className="os-num text-neutral">{a.mediaConsent?.releaseVersion ?? "—"}</Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        {!showDetail ? (
          <p className="border-t border-gray-mid px-4 py-2.5 text-xs text-neutral">
            Your role sees the operational status only. Who consented, when, and the release
            version are limited to roles that may view sensitive family information.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
