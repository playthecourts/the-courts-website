import "server-only";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { sendReplyNotification } from "@/lib/message-notifications";

// ---------------------------------------------------------------------------
// Two-way messaging: The Courts <-> one family.
//
// Three properties this module exists to guarantee:
//
//   1. A thread has exactly one family. There is no addressing mode that
//      reaches another family, so parent-to-parent contact cannot appear by
//      accident or by a later careless query.
//   2. No contact details cross in either direction. Staff address a family;
//      parents address The Courts. Nobody is handed a phone number or an email.
//   3. Exactly one author per message. A message is from a guardian OR from
//      staff, never ambiguous — which is what makes a thread readable months
//      later when somebody asks who said what.
//
// Broadcasts stay in Communication/CommunicationRecipient. This is only for
// conversations.
// ---------------------------------------------------------------------------

export type ThreadContext = {
  offeringId?: string | null;
  sessionId?: string | null;
  athleteId?: string | null;
  /// Set when a family replied to a broadcast, so the answer keeps its origin.
  communicationId?: string | null;
};

/// A parent starting or continuing a conversation.
export async function sendFamilyMessage(params: {
  guardianId: string;
  familyId: string;
  body: string;
  /// Omit to continue an existing thread.
  subject?: string;
  threadId?: string;
  context?: ThreadContext;
  /// Only meaningful when starting a new thread — whether a staff reply
  /// should also trigger a notification email. Defaults to true (the
  /// compose form's checkbox is checked by default).
  notifyByEmail?: boolean;
}) {
  const body = params.body.trim();
  if (!body) throw new Error("Write a message first.");

  return prisma.$transaction(async (tx) => {
    let threadId = params.threadId;

    if (threadId) {
      // Ownership is checked here, not by the caller: a thread id in a URL is
      // not proof the family owns it.
      const thread = await tx.messageThread.findFirst({
        where: { id: threadId, familyId: params.familyId },
        select: { id: true, status: true },
      });
      if (!thread) throw new Error("That conversation isn't available.");
      // A reply reopens a resolved thread rather than vanishing into it.
      if (thread.status === "resolved") {
        await tx.messageThread.update({ where: { id: threadId }, data: { status: "open" } });
      }
    } else {
      const created = await tx.messageThread.create({
        data: {
          familyId: params.familyId,
          subject: params.subject?.trim() || "Message to The Courts",
          offeringId: params.context?.offeringId ?? null,
          sessionId: params.context?.sessionId ?? null,
          athleteId: params.context?.athleteId ?? null,
          communicationId: params.context?.communicationId ?? null,
          notifyByEmail: params.notifyByEmail ?? true,
        },
      });
      threadId = created.id;
    }

    const message = await tx.message.create({
      data: {
        threadId,
        body,
        authorGuardianId: params.guardianId,
        // The sender has obviously seen their own message; staff have not.
        readByFamilyAt: new Date(),
      },
    });

    await tx.messageThread.update({
      where: { id: threadId },
      data: { lastMessageAt: message.createdAt },
    });

    return { threadId, messageId: message.id };
  });
}

/// Staff replying. Capability is checked by the caller (a server action);
/// this enforces the shape.
export async function sendStaffMessage(params: {
  staffUserId: string;
  threadId: string;
  body: string;
  resolve?: boolean;
}) {
  const body = params.body.trim();
  if (!body) throw new Error("Write a message first.");

  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        threadId: params.threadId,
        body,
        authorStaffId: params.staffUserId,
        readByStaffAt: new Date(),
      },
    });
    await tx.messageThread.update({
      where: { id: params.threadId },
      data: {
        lastMessageAt: message.createdAt,
        ...(params.resolve ? { status: "resolved" } : {}),
      },
    });
    return message;
  });

  await auditLog(params.staffUserId, "send_communication", "message_thread", params.threadId, {
    resolved: !!params.resolve,
  });

  // Best-effort notification — never lets an email problem block a staff
  // reply from landing in the portal, which is the system of record.
  await sendReplyNotification(params.threadId, body).catch((err) => {
    console.error("[messaging] reply notification failed", params.threadId, err);
  });
  return result;
}

/// Everything a family's inbox shows: their conversations plus the broadcasts
/// they were sent. Two different objects, one list, ordered by recency.
export async function familyInbox(guardianId: string, familyIds: string[]) {
  const [threads, broadcasts] = await Promise.all([
    prisma.messageThread.findMany({
      where: { familyId: { in: familyIds } },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: {
        athlete: { select: { firstName: true } },
        offering: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, authorStaffId: true, readByFamilyAt: true },
        },
        _count: { select: { messages: { where: { readByFamilyAt: null } } } },
      },
    }),
    prisma.communicationRecipient.findMany({
      where: { guardianId },
      orderBy: { communication: { sentAt: "desc" } },
      take: 50,
      include: {
        communication: {
          select: {
            id: true, subject: true, body: true, sentAt: true,
            sender: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return { threads, broadcasts };
}

export async function unreadCountForFamily(guardianId: string, familyIds: string[]) {
  const [threadUnread, broadcastUnread] = await Promise.all([
    prisma.message.count({
      where: {
        thread: { familyId: { in: familyIds } },
        authorStaffId: { not: null },
        readByFamilyAt: null,
      },
    }),
    prisma.communicationRecipient.count({ where: { guardianId, readAt: null } }),
  ]);
  return threadUnread + broadcastUnread;
}

/// Marks every staff message in a thread as seen by the family. Ownership is
/// re-checked here for the same reason as above.
export async function markThreadReadByFamily(threadId: string, familyIds: string[]) {
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, familyId: { in: familyIds } },
    select: { id: true },
  });
  if (!thread) return;
  await prisma.message.updateMany({
    where: { threadId, authorStaffId: { not: null }, readByFamilyAt: null },
    data: { readByFamilyAt: new Date() },
  });
}

export async function markThreadReadByStaff(threadId: string) {
  await prisma.message.updateMany({
    where: { threadId, authorGuardianId: { not: null }, readByStaffAt: null },
    data: { readByStaffAt: new Date() },
  });
}

/// A family's thread, with ownership enforced. Returns null rather than
/// throwing so the page can render a 404 that looks identical to "doesn't
/// exist" — a parent shouldn't be able to probe for other families' threads.
export async function threadForFamily(threadId: string, familyIds: string[]) {
  return prisma.messageThread.findFirst({
    where: { id: threadId, familyId: { in: familyIds } },
    include: {
      athlete: { select: { firstName: true } },
      offering: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          authorStaff: { select: { name: true, title: true } },
          authorGuardian: { select: { name: true } },
        },
      },
    },
  });
}
