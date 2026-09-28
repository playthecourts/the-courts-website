import Link from "next/link";
import type { Route } from "next";
import { getCurrentCoach, isLeadership } from "@/lib/coach-dal";
import { PageTitle, Card } from "@/components/coach/ui";
import { coachLogout } from "./actions";

// The bottom nav has linked here since the Coach App shipped — this page
// simply never existed, so every coach tapping "More" hit a 404. Same
// pattern gap as /coach/coverage (see coverage/page.tsx).

export const dynamic = "force-dynamic";

function Row({ href, label, desc }: { href: Route; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-4">
      <span className="min-w-0">
        <span className="block font-heading text-[15px] font-bold text-near-black">{label}</span>
        <span className="mt-0.5 block truncate font-body text-[13px] text-gray-dark">{desc}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 font-body text-lg text-gray-dark">
        &rsaquo;
      </span>
    </Link>
  );
}

export default async function CoachMorePage() {
  const actor = await getCurrentCoach();

  const items: { href: Route; label: string; desc: string }[] = [
    { href: "/coach/evaluations", label: "Evaluations", desc: "Skill notes you've started or need to finish." },
    { href: "/coach/open-shifts", label: "Open Shifts", desc: "Unstaffed sessions you can pick up." },
    {
      href: "/coach/coverage",
      label: "Coverage Requests",
      desc: isLeadership(actor) ? "Open requests and your own." : "Sessions you need covered, and ones assigned to you.",
    },
    { href: "/coach/time-off", label: "Time Off", desc: "Days you're not available to coach." },
  ];

  return (
    <div>
      <PageTitle eyebrow={actor.name}>More</PageTitle>

      <Card className="mb-4 divide-y divide-gray-mid overflow-hidden">
        {items.map((item) => (
          <Row key={item.href} {...item} />
        ))}
      </Card>

      <form action={coachLogout}>
        <button
          type="submit"
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-gray-mid bg-white px-4 font-heading text-sm font-bold uppercase tracking-wide text-near-black hover:border-near-black"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
