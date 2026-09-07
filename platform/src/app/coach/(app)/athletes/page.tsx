import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, athleteScope } from "@/lib/coach-dal";
import { formatGrade, initials } from "@/lib/coach-format";
import { activeFlagsFor, FLAG_LABELS } from "@/lib/coach-queries";
import { Card, PageTitle, EmptyState, Avatar } from "@/components/coach/ui";

export const dynamic = "force-dynamic";

export default async function CoachAthletesPage(props: PageProps<"/coach/athletes">) {
  const actor = await getCurrentCoach();
  const params = await props.searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim();

  // The search term narrows results INSIDE athleteScope() — it never widens
  // them. A basketball coach searching a volleyball athlete's name gets
  // nothing, because the scope filter is ANDed, not replaced.
  const athletes = await prisma.athlete.findMany({
    where: {
      AND: [
        athleteScope(actor),
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 100,
    select: { id: true, firstName: true, lastName: true, grade: true },
  });

  const flags = await activeFlagsFor(athletes.map((a) => a.id));

  return (
    <div>
      <PageTitle
        eyebrow={actor.role === "coach" ? "Your Athletes" : "Athletes"}
        sub={
          actor.role === "coach"
            ? "Athletes in the sessions and teams you're assigned to."
            : undefined
        }
      >
        Athletes
      </PageTitle>

      <form method="get" className="mb-4">
        <label htmlFor="athlete-search" className="sr-only">
          Search athletes
        </label>
        <input
          id="athlete-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name"
          className="min-h-[48px] w-full rounded-lg border border-gray-mid bg-white px-4 font-body text-base text-near-black focus:border-orange focus:outline-none"
        />
      </form>

      {athletes.length === 0 ? (
        <EmptyState
          title={q ? "No Match." : "Nobody Here Yet."}
          body={
            q
              ? "No athlete by that name in the groups you coach."
              : "Athletes will appear once they're registered for your programs."
          }
        />
      ) : (
        <Card>
          {athletes.map((a) => (
            <Link
              key={a.id}
              href={`/coach/athletes/${a.id}`}
              className="flex min-h-[60px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
            >
              <Avatar initials={initials(a.firstName, a.lastName)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-[15px] font-bold text-near-black">
                  {a.firstName} {a.lastName}
                </span>
                {a.grade && (
                  <span className="block font-body text-xs text-gray-dark">{formatGrade(a.grade)}</span>
                )}
              </span>
              <span className="flex shrink-0 gap-1">
                {(flags.get(a.id) ?? []).map((f) => (
                  <span
                    key={f}
                    className="rounded bg-orange px-1.5 py-0.5 font-sport text-[9.5px] font-bold uppercase tracking-wide text-white"
                  >
                    {FLAG_LABELS[f] ?? f}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
