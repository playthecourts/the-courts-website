import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { scopedSports } from "@/lib/os/permissions";
import { PageHeader, Card, CardHeader, EmptyState, Pill } from "../_components/ui";

export const dynamic = "force-dynamic";

// The other half of parent messaging. Families can write to The Courts; this is
// where somebody answers. A conversation nobody can reply to is worse than no
// conversation at all, because the family is left assuming they were heard.

const VIEWS = [
  { key: "open", label: "Needs a reply" },
  { key: "all", label: "All" },
  { key: "resolved", label: "Answered" },
] as const;

function when(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export default async function CommunicationsPage({ searchParams }: PageProps<"/os/communications">) {
  const actor = await requireCapability("communications.view");
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "open";

  const sports = scopedSports(actor);
  const scope =
    sports && sports.length > 0
      ? { OR: [{ offering: { program: { sport: { in: sports } } } }, { offeringId: null }] }
      : {};

  const threads = await prisma.messageThread.findMany({
    where: {
      AND: [
        scope,
        view === "open" ? { status: "open" as const } : {},
        view === "resolved" ? { status: "resolved" as const } : {},
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      family: { select: { name: true } },
      athlete: { select: { firstName: true } },
      offering: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true, authorGuardianId: true },
      },
      _count: { select: { messages: { where: { authorGuardianId: { not: null }, readByStaffAt: null } } } },
    },
  });

  const awaiting = threads.filter((t) => t.messages[0]?.authorGuardianId).length;

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Messages"
        subtitle="Conversations with families. Each one is between The Courts and a single family — families never see each other."
      />

      {awaiting > 0 && view === "open" ? (
        <div className="mb-5 rounded-xl border border-warning/30 bg-warning-bg p-4">
          <p className="os-eyebrow text-warning">
            {awaiting} conversation{awaiting === 1 ? "" : "s"} where a family spoke last
          </p>
          <p className="mt-1 text-sm text-warning">
            Nothing is sent automatically — a reply here appears in their Parent App.
          </p>
        </div>
      ) : null}

      <nav aria-label="Message views" className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/os/communications?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={`os-eyebrow inline-flex min-h-9 items-center rounded-full border px-3 ${
              view === v.key
                ? "border-near-black bg-near-black text-white"
                : "border-gray-mid bg-white text-gray-dark hover:border-near-black"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader title="Conversations" count={threads.length} />
        {threads.length === 0 ? (
          <EmptyState
            headline={view === "open" ? "Nothing waiting." : "No conversations yet."}
            detail={
              view === "open"
                ? "Every family who wrote in has been answered."
                : "When a family asks something in the Parent App, it lands here."
            }
          />
        ) : (
          <ul className="divide-y divide-gray-mid">
            {threads.map((t) => {
              const last = t.messages[0];
              const familySpokeLast = !!last?.authorGuardianId;
              return (
                <li key={t.id}>
                  <Link
                    href={`/os/communications/${t.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-warm-white"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        familySpokeLast ? "bg-orange" : "bg-transparent"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="os-heading truncate text-sm text-near-black">{t.subject}</span>
                        <span className="shrink-0 text-xs text-neutral">
                          {last ? when(last.createdAt) : ""}
                        </span>
                      </span>
                      {last ? (
                        <span className="mt-0.5 line-clamp-1 block text-sm text-gray-dark">
                          {familySpokeLast ? "" : "You: "}
                          {last.body}
                        </span>
                      ) : null}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral">
                        {t.family.name}
                        {t.athlete ? ` · about ${t.athlete.firstName}` : ""}
                        {t.offering ? ` · ${t.offering.name}` : ""}
                        {t.status === "resolved" ? <Pill tone="neutral">Answered</Pill> : null}
                        {familySpokeLast ? <Pill tone="warning">Needs a reply</Pill> : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
