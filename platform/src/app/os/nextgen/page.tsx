import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Metric, TableWrap, Th, Td } from "../_components/ui";
import { approveAsFounderAnyway, requestMoreInfo, moveToUnlimited, denyLegacyRate, setLegacyRate, linkNextGenRecord } from "./actions";

export const dynamic = "force-dynamic";

// NextGen (the old gym) closes October 1, 2026. Families self-report their
// status at signup (Current / Former / New) — this is where that
// self-report gets reconciled against the official member list once it
// arrives: link a real historical record, approve as a Founder anyway, or
// move someone to Unlimited without cancelling/clawing back anything. See
// the doc comments in ./actions.ts for exactly what each action does (and
// doesn't) touch in Stripe.

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}/mo`;
}

const VERIFICATION_LABEL: Record<string, string> = {
  unverified: "Pending Verification",
  verified: "Verified Founder",
  not_eligible: "Unable to Verify",
  admin_approved: "Admin Approved",
};

const VERIFICATION_TONE: Record<string, "success" | "danger" | "neutral" | "info"> = {
  unverified: "neutral",
  verified: "success",
  not_eligible: "danger",
  admin_approved: "info",
};

// Simple candidate surfacing, not a scored/ranked matcher — this is dozens
// of historical rows, not thousands, and a human confirms every link
// anyway. Exact/near email match is a strong signal; a name-token overlap
// is a weaker one shown for the admin to eyeball, since a family may have
// signed up under an entirely different email address.
async function findCandidateGuardians(record: { name: string; email: string }) {
  const nameParts = record.name.trim().split(/\s+/).filter((p) => p.length > 1);
  const [emailMatches, nameMatches] = await Promise.all([
    prisma.guardian.findMany({
      where: { email: { equals: record.email, mode: "insensitive" } },
      take: 5,
    }),
    nameParts.length > 0
      ? prisma.guardian.findMany({
          where: { OR: nameParts.map((part) => ({ name: { contains: part, mode: "insensitive" as const } })) },
          take: 5,
        })
      : Promise.resolve([]),
  ]);
  const seen = new Map<string, { guardian: (typeof emailMatches)[number]; reason: string }>();
  for (const g of emailMatches) seen.set(g.id, { guardian: g, reason: "email match" });
  for (const g of nameMatches) if (!seen.has(g.id)) seen.set(g.id, { guardian: g, reason: "name match" });
  return [...seen.values()];
}

export default async function NextGenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; verification?: string }>;
}) {
  await requireCapability("nextgen.verify");

  const sp = await searchParams;
  const statusFilter = sp.status === "former_nextgen" || sp.status === "current_nextgen" ? sp.status : undefined;
  const verificationFilter =
    sp.verification === "unverified" ||
    sp.verification === "verified" ||
    sp.verification === "not_eligible" ||
    sp.verification === "admin_approved"
      ? sp.verification
      : undefined;

  const [guardians, claimedCount, unmatchedRecords] = await Promise.all([
    prisma.guardian.findMany({
      where: {
        nextGenStatus: { not: null },
        ...(statusFilter ? { nextGenStatus: statusFilter } : {}),
        ...(verificationFilter ? { nextGenVerification: verificationFilter } : {}),
      },
      include: {
        families: {
          include: {
            family: {
              include: {
                athletes: {
                  include: {
                    memberships: {
                      where: { status: { in: ["active", "past_due"] } },
                      orderBy: { createdAt: "desc" },
                      take: 1,
                      include: { plan: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Verification state, not live subscription status — a Founder who
    // later cancels still counts as one of the 25 the business actually
    // confirmed. `verified` (matched) and `admin_approved` (manual
    // override) both count as real claims.
    prisma.guardian.count({
      where: {
        nextGenStatus: "former_nextgen",
        isFounder: true,
        nextGenVerification: { in: ["verified", "admin_approved"] },
      },
    }),
    prisma.nextGenRecord.findMany({ where: { matchedGuardianId: null }, orderBy: { createdAt: "asc" } }),
  ]);

  const hasFilters = Boolean(statusFilter || verificationFilter);

  return (
    <div>
      <PageHeader
        eyebrow="NextGen Transition"
        title="NextGen Transfers"
        subtitle="Reconcile self-reported NextGen families against the official member list — link real records, approve Founders, and move unconfirmed claims to Unlimited without cancelling anything."
      />

      <div className="mb-5">
        <Metric label="Founders Claimed" value={`${claimedCount} / 25`} detail="Verified or admin-approved former NextGen families" />
      </div>

      <form method="get" action="/os/nextgen" className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="status" className="os-eyebrow mb-1.5 block text-gray-dark">Status</label>
          <select
            id="status" name="status" defaultValue={statusFilter ?? ""}
            className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          >
            <option value="">All</option>
            <option value="former_nextgen">Former NextGen</option>
            <option value="current_nextgen">Current NextGen</option>
          </select>
        </div>
        <div>
          <label htmlFor="verification" className="os-eyebrow mb-1.5 block text-gray-dark">Verification</label>
          <select
            id="verification" name="verification" defaultValue={verificationFilter ?? ""}
            className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          >
            <option value="">Any</option>
            <option value="unverified">Pending Verification</option>
            <option value="verified">Verified Founder</option>
            <option value="admin_approved">Admin Approved</option>
            <option value="not_eligible">Unable to Verify</option>
          </select>
        </div>
        <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
          Apply
        </button>
        {hasFilters ? (
          <Link href="/os/nextgen" className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">
            Clear
          </Link>
        ) : null}
      </form>

      <Card className="mb-6">
        <CardHeader title="NextGen Families" count={guardians.length} />
        {guardians.length === 0 ? (
          <EmptyState
            headline="Nobody here yet."
            detail={hasFilters ? "No families match these filters." : "No families have self-reported a NextGen status yet."}
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <Th>Guardian</Th>
                  <Th>Athlete(s)</Th>
                  <Th>Status</Th>
                  <Th>Verification</Th>
                  <Th>Founder</Th>
                  <Th>Legacy Rate</Th>
                  <Th>Current Membership</Th>
                  <Th>Current Stripe Price</Th>
                  <Th>Stripe Customer</Th>
                  <Th>Stripe Subscription</Th>
                  <Th>Effective Date</Th>
                  <Th>Next Billing</Th>
                  <Th>Sub Status</Th>
                  <Th>Notes</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {guardians.map((g) => {
                  const athleteNames = g.families.flatMap((fg) => fg.family.athletes).map((a) => a.firstName);
                  const membership = g.families
                    .flatMap((fg) => fg.family.athletes)
                    .flatMap((a) => a.memberships)[0];

                  return (
                    <tr key={g.id}>
                      <Td>
                        <span className="font-medium text-near-black">{g.name}</span>
                        <br />
                        <span className="text-neutral">{g.email ?? "—"}</span>
                      </Td>
                      <Td className="text-neutral">{athleteNames.join(", ") || "—"}</Td>
                      <Td>
                        <Pill tone={g.nextGenStatus === "current_nextgen" ? "warning" : "info"}>
                          {g.nextGenStatus === "current_nextgen" ? "Current" : "Former"}
                        </Pill>
                      </Td>
                      <Td>
                        <Pill tone={VERIFICATION_TONE[g.nextGenVerification ?? "unverified"]}>
                          {VERIFICATION_LABEL[g.nextGenVerification ?? "unverified"]}
                        </Pill>
                      </Td>
                      <Td>{g.isFounder ? "Yes" : "No"}</Td>
                      <Td className="os-num text-neutral">
                        {g.legacyRateCents != null ? formatCents(g.legacyRateCents) : "Not set"}
                      </Td>
                      <Td className="text-neutral">{membership?.plan.name ?? "—"}</Td>
                      <Td className="os-num text-neutral">
                        {membership ? formatCents(membership.plan.priceCents) : "—"}
                      </Td>
                      <Td className="text-neutral font-mono text-xs">{g.stripeCustomerId ?? "—"}</Td>
                      <Td className="text-neutral font-mono text-xs">{membership?.stripeSubscriptionId ?? "—"}</Td>
                      <Td className="text-neutral">
                        {membership?.startDate
                          ? new Date(membership.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </Td>
                      <Td className="text-neutral">
                        {membership?.renewalDate
                          ? new Date(membership.renewalDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </Td>
                      <Td className="text-neutral">{membership?.status ?? "—"}</Td>
                      <Td className="max-w-[160px] text-neutral">{g.nextGenNotes ?? "—"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {g.nextGenVerification !== "verified" && g.nextGenVerification !== "admin_approved" && (
                            <form action={approveAsFounderAnyway.bind(null, g.id)}>
                              <button
                                type="submit"
                                className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide hover:border-near-black"
                              >
                                Approve as Founder Anyway
                              </button>
                            </form>
                          )}
                          {g.nextGenStatus !== "current_nextgen" && g.nextGenVerification !== "not_eligible" && (
                            <form action={moveToUnlimited.bind(null, g.id)}>
                              <button
                                type="submit"
                                className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide text-danger hover:border-danger"
                              >
                                Move to Unlimited
                              </button>
                            </form>
                          )}
                          {g.nextGenStatus === "current_nextgen" && g.nextGenVerification !== "not_eligible" && (
                            <form action={denyLegacyRate.bind(null, g.id)}>
                              <button
                                type="submit"
                                className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide text-danger hover:border-danger"
                              >
                                Deny Rate
                              </button>
                            </form>
                          )}
                          <form action={requestMoreInfo.bind(null, g.id)} className="flex items-center gap-1">
                            <input
                              type="text"
                              name="note"
                              placeholder="Note…"
                              defaultValue={g.nextGenNotes ?? ""}
                              className="min-h-9 w-28 rounded-lg border border-gray-mid bg-white px-2 text-xs focus:border-orange focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-2 text-xs uppercase tracking-wide hover:border-near-black"
                            >
                              Save Note
                            </button>
                          </form>
                          {g.nextGenStatus === "current_nextgen" && (
                            <form action={setLegacyRate.bind(null, g.id)} className="flex items-center gap-1">
                              <input
                                type="number"
                                name="legacyRate"
                                step="0.01"
                                min="0"
                                placeholder="Rate $"
                                defaultValue={g.legacyRateCents != null ? (g.legacyRateCents / 100).toFixed(2) : ""}
                                className="min-h-9 w-20 rounded-lg border border-gray-mid bg-white px-2 text-xs focus:border-orange focus:outline-none"
                              />
                              <button
                                type="submit"
                                className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-2 text-xs uppercase tracking-wide hover:border-near-black"
                              >
                                Approve Rate
                              </button>
                            </form>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Unmatched NextGen Records" count={unmatchedRecords.length} />
        {unmatchedRecords.length === 0 ? (
          <EmptyState headline="Nothing to match." detail="Every imported historical record is linked to a Courts account." />
        ) : (
          <div className="flex flex-col divide-y divide-gray-mid">
            {await Promise.all(
              unmatchedRecords.map(async (record) => {
                const candidates = await findCandidateGuardians(record);
                return (
                  <div key={record.id} className="px-4 py-3">
                    <p className="text-sm">
                      <span className="font-medium text-near-black">{record.name}</span>{" "}
                      <span className="text-neutral">· {record.email}</span>
                      {record.legacyRateCents != null && (
                        <span className="text-neutral"> · {formatCents(record.legacyRateCents)}</span>
                      )}
                    </p>
                    {candidates.length === 0 ? (
                      <p className="mt-1 text-xs text-neutral">No candidate Courts accounts found.</p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {candidates.map(({ guardian, reason }) => (
                          <div key={guardian.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-near-black">{guardian.name}</span>
                            <span className="text-neutral">{guardian.email}</span>
                            <span className="text-neutral">({reason})</span>
                            <form action={linkNextGenRecord.bind(null, record.id, guardian.id)}>
                              <button
                                type="submit"
                                className="os-heading min-h-7 rounded-lg border border-gray-mid bg-white px-2 uppercase tracking-wide hover:border-near-black"
                              >
                                Link this account
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
