import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const SNIPPET_MAX = 140;

/**
 * A short, non-final-answer preview of the reply — long enough to give
 * context, short enough that reading the email is never a substitute for
 * opening the thread. Cuts on a word boundary rather than mid-word.
 */
function snippetFor(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= SNIPPET_MAX) return trimmed;
  const cut = trimmed.slice(0, SNIPPET_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : SNIPPET_MAX)}…`;
}

/**
 * Fires after a staff reply. Portal is always the system of record; this is
 * only the "someone replied" nudge, sent to every guardian on the family who
 * has an email on file — governed by the thread's own notifyByEmail choice,
 * made on the compose form when the family started the conversation.
 */
export async function sendReplyNotification(threadId: string, replyBody: string) {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: {
      notifyByEmail: true,
      family: {
        select: {
          guardians: {
            select: { guardian: { select: { email: true } } },
          },
        },
      },
    },
  });
  if (!thread || !thread.notifyByEmail) return;

  const recipients = thread.family.guardians
    .map((fg) => fg.guardian.email)
    .filter((email): email is string => !!email);
  if (recipients.length === 0) return;

  const threadUrl = `https://app.playthecourts.com/my-courts/messages/${threadId}`;
  const snippet = snippetFor(replyBody);
  const subject = "The Courts replied to your message";
  const previewText = "You have a new reply waiting in your member portal.";

  const text = `${previewText}\n\nYou've got a reply from The Courts.\n\n"${snippet}"\n\nView the message: ${threadUrl}`;

  const html = `
<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 16px;">You&rsquo;ve got a reply from The Courts.</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    &ldquo;${snippet}&rdquo;
  </p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#1A1A1A;">
    Log in to your member portal to view the message and continue the conversation.
  </p>
  <a href="${threadUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View Message &rarr;
  </a>
</div>`.trim();

  await Promise.all(
    recipients.map((to) => sendEmail({ to, subject, html, text }))
  );
}

const STAFF_INBOX = "hello@playthecourts.com";

/**
 * Fires when a family starts a NEW conversation (not on every reply within
 * one — that would be noisy). Staff has no other way to know a message is
 * waiting short of checking Courts OS, so this is the "someone needs you"
 * signal, not optional the way the parent-side reply nudge is.
 */
export async function sendNewThreadStaffAlert(threadId: string) {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: {
      subject: true,
      family: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 1, select: { body: true } },
    },
  });
  if (!thread) return;

  const threadUrl = `https://app.playthecourts.com/os/communications/${threadId}`;
  const snippet = snippetFor(thread.messages[0]?.body ?? "");
  const subject = `New message from ${thread.family.name}`;
  const text = `${thread.family.name} sent a new message: "${thread.subject}"\n\n"${snippet}"\n\nView in Courts OS: ${threadUrl}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">New message from ${thread.family.name}</p>
  <p style="font-size:13px;color:#343434;margin:0 0 16px;">${thread.subject}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    &ldquo;${snippet}&rdquo;
  </p>
  <a href="${threadUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View in Courts OS &rarr;
  </a>
</div>`.trim();

  await sendEmail({ to: STAFF_INBOX, subject, html, text });
}
