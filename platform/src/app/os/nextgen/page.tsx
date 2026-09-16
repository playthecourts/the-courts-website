import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, CardHeader, EmptyState, Pill, Metric, TableWrap, Th, Td } from "../_components/ui";
import { verifyFormerNextGen, markNotEligible, setLegacyRate } from "./actions";

export const dynamic = "force-dynamic";

// NextGen (the old gym) closes October 1, 2026. Families self-report their
// status at signup (Current / Former / New) — this is where that
// self-report gets reconciled against the official member list once it
// arrives: verify a Former NextGen family as one of the first 25 real
// Founders, mark a claim not eligible, or assign a Current NextGen family's
// real legacy rate. None of the actions here touch Stripe directly — see
// the doc comments in ./actions.ts for why.

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}/mo`;
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
    sp.verification === "unverified" || sp.verification === "verified" || sp.verification === "not_eligible"
      ? sp.verification
      : undefined;

  const [guardians, claimedCount] = await Promise.all([
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
    prisma.guardian.count({
      where: { nextGenStatus: "former_nextgen", nextGenVerification: "verified", isFounder: true },
    }),
  ]);

  const hasFilters = Boolean(statusFilter || verificationFilter);

  return (
    <div>
      <PageHeader
        eyebrow="NextGen Transition"
        title="NextGen Transfers"
        subtitle="Reconcile self-reported NextGen families against the official member list — verify Founders, mark ineligible claims, and assign Current NextGen legacy rates."
      />

      <div className="mb-5">
        <Metric label="Founders Claimed" value={`${claimedCount} / 25`} detail="Verified former NextGen families" />
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
            <option value="unverified">Unverified</option>
            <option value="verified">Verified</option>
            <option value="not_eligible">Not Eligible</option>
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

      <Card>
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
                  <Th>Status</Th>
                  <Th>Verification</Th>
                  <Th>Founder</Th>
                  <Th>Legacy Rate</Th>
                  <Th>Next Billing</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {guardians.map((g) => {
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
                      <Td>
                        <Pill tone={g.nextGenStatus === "current_nextgen" ? "warning" : "info"}>
                          {g.nextGenStatus === "current_nextgen" ? "Current" : "Former"}
                        </Pill>
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            g.nextGenVerification === "verified"
                              ? "success"
                              : g.nextGenVerification === "not_eligible"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {g.nextGenVerification === "verified"
                            ? "Verified"
                            : g.nextGenVerification === "not_eligible"
                              ? "Not Eligible"
                              : "Unverified"}
                        </Pill>
                      </Td>
                      <Td>{g.isFounder ? "Yes" : "No"}</Td>
                      <Td className="os-num text-neutral">
                        {g.legacyRateCents != null ? formatCents(g.legacyRateCents) : "Not set"}
                      </Td>
                      <Td className="text-neutral">
                        {membership?.renewalDate
                          ? new Date(membership.renewalDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </Td>
                      <Td>
                        {g.nextGenStatus === "former_nextgen" && (
                          <div className="flex flex-wrap gap-2">
                            {g.nextGenVerification !== "verified" && (
                              <form action={verifyFormerNextGen.bind(null, g.id)}>
                                <button
                                  type="submit"
                                  className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide hover:border-near-black"
                                >
                                  Verify (Founder)
                                </button>
                              </form>
                            )}
                            {g.nextGenVerification !== "not_eligible" && (
                              <form action={markNotEligible.bind(null, g.id)}>
                                <button
                                  type="submit"
                                  className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide text-danger hover:border-danger"
                                >
                                  Not Eligible
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                        {g.nextGenStatus === "current_nextgen" && (
                          <form action={setLegacyRate.bind(null, g.id)} className="flex items-center gap-2">
                            <input
                              type="number"
                              name="legacyRate"
                              step="0.01"
                              min="0"
                              placeholder="Rate $"
                              defaultValue={g.legacyRateCents != null ? (g.legacyRateCents / 100).toFixed(2) : ""}
                              className="min-h-9 w-24 rounded-lg border border-gray-mid bg-white px-2 text-sm focus:border-orange focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="os-heading min-h-9 rounded-lg border border-gray-mid bg-white px-3 text-xs uppercase tracking-wide hover:border-near-black"
                            >
                              Save &amp; Verify
                            </button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
