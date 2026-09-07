import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { can, canForSport } from "@/lib/os/permissions";
import { markThreadReadByStaff } from "@/lib/messaging";
import { PageHeader, Card, Pill } from "../../_components/ui";
import { StaffReplyForm } from "./staff-reply-form";

export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);

export default async function StaffThreadPage({ params }: PageProps<"/os/communications/[threadId]">) {
  const actor = await requireCapability("communications.view");
  const { threadId } = await params;

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: {
      family: { select: { id: true, name: true } },
      athlete: { select: { id: true, firstName: true, lastName: true } },
      offering: { select: { id: true, name: true, program: { select: { sport: true } } } },
      session: { select: { id: true, startTime: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          authorStaff: { select: { name: true, title: true } },
          authorGuardian: { select: { name: true } },
        },
      },
    },
  });
  if (!thread) notFound();

  const sport = thread.offering?.program.sport ?? null;
  // A head coach outside this sport gets the same answer as a stranger.
  if (!canForSport(actor, "communications.view", sport)) notFound();

  await markThreadReadByStaff(threadId);
  const canReply = can(actor, "communications.send") && canForSport(actor, "communications.send", sport);

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow={
          <Link href="/os/communications" className="underline underline-offset-2">
            Messages
          </Link>
        }
        title={thread.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2 text-sm text-gray-dark">
            {thread.family.name}
            {thread.athlete ? ` · about ${thread.athlete.firstName} ${thread.athlete.lastName}` : ""}
            {thread.offering ? (
              <Link href={`/os/offerings/${thread.offering.id}`} className="underline underline-offset-2">
                {thread.offering.name}
              </Link>
            ) : null}
            {thread.status === "resolved" ? <Pill tone="neutral">Answered</Pill> : null}
          </span>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3">
          {thread.messages.map((m) => {
            const fromStaff = !!m.authorStaffId;
            return (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  fromStaff
                    ? "self-end bg-near-black text-white"
                    : "self-start border border-gray-mid bg-warm-white"
                }`}
              >
                <p className={`os-eyebrow ${fromStaff ? "text-white/60" : "text-orange"}`}>
                  {fromStaff
                    ? `${m.authorStaff?.name ?? "The Courts"}${m.authorStaff?.title ? ` · ${m.authorStaff.title}` : ""}`
                    : m.authorGuardian?.name ?? "Family"}
                  {" · "}
                  {stamp(m.createdAt)}
                </p>
                <p className={`mt-1 whitespace-pre-line text-sm ${fromStaff ? "text-white" : "text-gray-dark"}`}>
                  {m.body}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {canReply ? (
        <StaffReplyForm threadId={thread.id} resolved={thread.status === "resolved"} />
      ) : (
        <p className="text-sm text-neutral">
          Your role can read this conversation but not reply to it.
        </p>
      )}
    </div>
  );
}
