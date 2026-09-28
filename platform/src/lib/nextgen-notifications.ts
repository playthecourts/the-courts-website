import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/programs/format";

// The real gap this closes: a NextGen family gets approved (verified or
// admin_approved) and given a rate, but nothing in the app ever tells THEM
// that — the "Complete Your Transfer" button only exists on a page they'd
// have to think to visit. This sends it once, ever, per guardian
// (nextGenReminderSentAt), not on a recurring nag schedule.
const MEMBERSHIPS_URL = "https://app.playthecourts.com/my-courts/memberships";

export async function sendNextGenReminderEmails(): Promise<{ sent: number; skipped: number; errors: number }> {
  const candidates = await prisma.guardian.findMany({
    where: {
      nextGenStatus: { not: null },
      nextGenVerification: { in: ["verified", "admin_approved"] },
      nextGenReminderSentAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      nextGenStatus: true,
      legacyRateCents: true,
      families: { select: { family: { select: { athletes: { select: { firstName: true, memberships: { select: { status: true } } } } } } } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const g of candidates) {
    const athletes = g.families.flatMap((fg) => fg.family.athletes);
    const hasMembership = athletes.some((a) => a.memberships.some((m) => m.status === "active" || m.status === "past_due"));
    // Re-check right before sending — a family could complete checkout
    // between when this list was built and when this loop reaches them.
    if (hasMembership || !g.email) {
      skipped++;
      continue;
    }

    const athleteNames = athletes.map((a) => a.firstName).join(" and ") || "your athlete";
    const isCurrent = g.nextGenStatus === "current_nextgen";
    const rateLine =
      isCurrent && g.legacyRateCents != null
        ? `Your confirmed rate is ${formatCents(g.legacyRateCents)}/mo — the same as your NextGen rate, carried over.`
        : "You're approved for Founders Membership at $165/mo — exclusive to former NextGen families.";

    const subject = "Your NextGen membership transfer is ready to complete";
    const text = `Hi ${g.name.split(" ")[0]},\n\n${rateLine}\n\n${athleteNames} isn't on an active membership yet — complete checkout whenever you're ready:\n${MEMBERSHIPS_URL}\n\nQuestions? Just reply to this email.`;
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">Hi ${g.name.split(" ")[0]},</p>
  <p style="font-size:15px;line-height:1.6;margin:12px 0 20px;color:#1A1A1A;">${rateLine}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    ${athleteNames} isn&rsquo;t on an active membership yet.
  </p>
  <a href="${MEMBERSHIPS_URL}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    Complete Your Transfer &rarr;
  </a>
  <p style="font-size:13px;color:#6B6B6B;margin-top:24px;">Questions? Just reply to this email.</p>
</div>`.trim();

    const result = await sendEmail({ to: g.email, subject, html, text });
    if (result.ok) {
      await prisma.guardian.update({ where: { id: g.id }, data: { nextGenReminderSentAt: new Date() } });
      sent++;
    } else {
      errors++;
    }
  }

  return { sent, skipped, errors };
}
