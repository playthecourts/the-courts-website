import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { NewThreadForm } from "./new-thread-form";

export default async function NewMessagePage({ searchParams }: PageProps<"/my-courts/messages/new">) {
  const sp = await searchParams;
  const re = typeof sp.re === "string" ? sp.re : null;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  // Only quote a broadcast this guardian actually received.
  const replyingTo = re
    ? await prisma.communicationRecipient.findFirst({
        where: { communicationId: re, guardianId: guardian.id },
        include: { communication: { select: { subject: true } } },
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/my-courts/messages" className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
          ← Messages
        </Link>
        <h1 className="mt-2 font-display text-xl font-black text-black">Ask The Courts</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          Have a question about your athlete, membership, registration, schedule, or anything
          else? Send us a message here and our team will get back to you.
        </p>
        <p className="mt-1 font-body text-sm text-gray-dark">
          Replies will appear here in your member portal.
        </p>
      </div>
      <NewThreadForm
        athletes={athletes.map((a) => ({ id: a.id, firstName: a.firstName }))}
        defaultSubject={replyingTo ? `Re: ${replyingTo.communication.subject}` : ""}
      />
    </div>
  );
}
