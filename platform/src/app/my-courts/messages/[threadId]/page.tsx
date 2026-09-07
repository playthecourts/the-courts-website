import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { threadForFamily, markThreadReadByFamily } from "@/lib/messaging";
import { ReplyForm } from "./reply-form";

const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);

export default async function ThreadPage({ params }: PageProps<"/my-courts/messages/[threadId]">) {
  const { threadId } = await params;
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.family.id);

  const thread = await threadForFamily(threadId, familyIds);
  // Not-found and not-yours look identical on purpose: a parent must not be
  // able to probe for the existence of another family's conversation.
  if (!thread) notFound();

  await markThreadReadByFamily(threadId, familyIds);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/my-courts/messages"
          className="font-sport text-xs font-bold uppercase tracking-wide text-orange"
        >
          ← Messages
        </Link>
        <h1 className="mt-2 font-display text-xl font-black text-black">{thread.subject}</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          {[
            thread.athlete ? `About ${thread.athlete.firstName}` : null,
            thread.offering?.name,
            thread.status === "resolved" ? "Answered" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "With The Courts"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {thread.messages.map((m) => {
          const fromCourts = !!m.authorStaffId;
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                fromCourts
                  ? "self-start border border-gray-mid bg-white"
                  : "self-end bg-black text-white"
              }`}
            >
              <p className={`font-sport text-[10px] font-bold uppercase tracking-widest ${fromCourts ? "text-orange" : "text-white/60"}`}>
                {fromCourts
                  ? m.authorStaff?.name ?? "The Courts"
                  : m.authorGuardian?.name ?? "You"}
                {" · "}
                {stamp(m.createdAt)}
              </p>
              <p className={`mt-1 whitespace-pre-line font-body text-sm ${fromCourts ? "text-gray-dark" : "text-white"}`}>
                {m.body}
              </p>
            </div>
          );
        })}
      </div>

      <ReplyForm threadId={thread.id} />
    </div>
  );
}
