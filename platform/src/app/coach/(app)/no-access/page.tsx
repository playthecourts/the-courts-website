import { ActionLink, Card } from "@/components/coach/ui";
import { getCurrentCoach } from "@/lib/coach-dal";

// Where every server-side denial lands. Plain language — an access boundary is
// operational information, not a place for Courts personality.
export default async function NoAccessPage() {
  await getCurrentCoach();

  return (
    <div className="pt-6">
      <Card className="px-5 py-8 text-center">
        <h1 className="font-display text-xl font-black uppercase tracking-tight text-near-black">
          You don&apos;t have access to that.
        </h1>
        <p className="mx-auto mt-2 max-w-sm font-body text-sm text-gray-dark">
          That session, athlete or team isn&apos;t part of what you&apos;re assigned to. If you think
          it should be, ask a Courts admin or your head coach to update your assignments.
        </p>
        <div className="mt-6">
          <ActionLink href="/coach">Back to Today</ActionLink>
        </div>
      </Card>
    </div>
  );
}
