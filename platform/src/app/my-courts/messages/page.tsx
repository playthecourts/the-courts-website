import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { familyInbox } from "@/lib/messaging";

// One inbox, two kinds of thing: announcements The Courts sent out, and
// conversations this family is having with The Courts. No other family appears
// here, and there is no way to reach one.

function when(d: Date) {
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export default async function MessagesPage() {
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.family.id);
  const { threads, broadcasts } = await familyInbox(guardian.id, familyIds);

  const isEmpty = threads.length === 0 && broadcasts.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-black">Messages</h1>
          <p className="mt-1 font-body text-sm text-gray-dark">
            Between you and The Courts.
          </p>
        </div>
        <Link
          href="/my-courts/messages/new"
          className="min-h-11 shrink-0 rounded-md bg-black px-4 py-2.5 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
        >
          Ask a Question
        </Link>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">All Quiet.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            Nothing from The Courts yet. If you need something, ask — it goes straight to the
            front desk.
          </p>
        </div>
      ) : null}

      {threads.length > 0 ? (
        <section>
          <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
            Your conversations
          </h2>
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {threads.map((t) => {
              const last = t.messages[0];
              const unread = t._count.messages > 0;
              return (
                <Link
                  key={t.id}
                  href={`/my-courts/messages/${t.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-light"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-orange" : "bg-transparent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`truncate font-heading text-sm ${unread ? "font-bold text-black" : "text-gray-dark"}`}>
                        {t.subject}
                      </span>
                      {last ? (
                        <span className="shrink-0 font-body text-xs text-gray-dark">
                          {when(last.createdAt)}
                        </span>
                      ) : null}
                    </span>
                    {last ? (
                      <span className="mt-0.5 line-clamp-1 block font-body text-sm text-gray-dark">
                        {last.body}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block font-body text-xs text-gray-dark">
                      {[
                        t.athlete ? `About ${t.athlete.firstName}` : null,
                        t.offering?.name,
                        t.status === "resolved" ? "Answered" : null,
                        unread ? `${t._count.messages} new` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {broadcasts.length > 0 ? (
        <section>
          <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-widest text-gray-dark">
            From The Courts
          </h2>
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {broadcasts.map((r) => (
              <article key={r.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className={`font-heading text-sm ${r.readAt ? "text-gray-dark" : "font-bold text-black"}`}>
                    {r.communication.subject}
                  </h3>
                  <span className="shrink-0 font-body text-xs text-gray-dark">
                    {when(r.communication.sentAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line font-body text-sm text-gray-dark">
                  {r.communication.body}
                </p>
                <p className="mt-2 font-body text-xs text-gray-dark">
                  {r.communication.sender.name} ·{" "}
                  <Link
                    href={`/my-courts/messages/new?re=${r.communication.id}`}
                    className="font-sport font-bold uppercase tracking-wide text-orange"
                  >
                    Reply
                  </Link>
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
