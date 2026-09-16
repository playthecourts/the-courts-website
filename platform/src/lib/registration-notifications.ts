import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/programs/format";

// Best-effort staff alert, same pattern and inbox as sendNewThreadStaffAlert
// (lib/message-notifications.ts) — a failure here must never affect the real
// registration, which is already confirmed in the database by the time this
// runs. Portal/Courts OS stays the system of record; this is only the
// "someone needs you to know about this" signal, since staff otherwise has no
// way to learn a family registered short of checking /os/registrations.
const STAFF_INBOX = "melissa@playthecourts.com";

export async function sendRegistrationStaffAlert(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      amountCents: true,
      athlete: { select: { firstName: true, lastName: true, family: { select: { name: true } } } },
      offering: { select: { name: true, priceCents: true } },
    },
  });
  if (!registration) return;

  const { athlete, offering } = registration;
  const athleteName = `${athlete.firstName} ${athlete.lastName}`;
  const amount = formatCents(registration.amountCents ?? offering.priceCents);
  const registrationsUrl = "https://app.playthecourts.com/os/registrations";
  const subject = `New registration: ${athleteName} — ${offering.name}`;
  const text = `${athleteName} (${athlete.family.name}) registered and paid for ${offering.name} — ${amount}.\n\nView in Courts OS: ${registrationsUrl}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">New registration: ${athleteName}</p>
  <p style="font-size:13px;color:#343434;margin:0 0 16px;">${offering.name} · ${athlete.family.name}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    Paid ${amount}
  </p>
  <a href="${registrationsUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View in Courts OS &rarr;
  </a>
</div>`.trim();

  await sendEmail({ to: STAFF_INBOX, subject, html, text });
}

// Fires when a League payment succeeds but the bundled membership
// subscription fails to create right after (see startLeagueRegistration).
// The League seat is never rolled back for this — the family already paid
// for it — but staff needs to know a family is short a membership before
// the season, same "otherwise no one would know" gap as the alert above.
export async function sendMembershipSetupFailedAlert(registrationId: string, errorMessage: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      athlete: { select: { firstName: true, lastName: true, family: { select: { name: true } } } },
      offering: { select: { name: true } },
    },
  });
  if (!registration) return;

  const { athlete } = registration;
  const athleteName = `${athlete.firstName} ${athlete.lastName}`;
  const membershipsUrl = "https://app.playthecourts.com/os/registrations";
  const subject = `Membership setup failed after payment: ${athleteName}`;
  const text = `${athleteName} (${athlete.family.name}) paid for ${registration.offering.name}, but the bundled membership subscription failed to create.\n\nError: ${errorMessage}\n\nThe family will see a "Finish setting up membership" prompt in their app, but may need a manual follow-up.\n\nView in Courts OS: ${membershipsUrl}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">Membership setup failed: ${athleteName}</p>
  <p style="font-size:13px;color:#343434;margin:0 0 16px;">${registration.offering.name} · ${athlete.family.name} — payment succeeded, subscription did not.</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#FDE7F0;border-left:3px solid #E0369D;padding:12px 16px;border-radius:6px;">
    ${errorMessage}
  </p>
  <a href="${membershipsUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View in Courts OS &rarr;
  </a>
</div>`.trim();

  await sendEmail({ to: STAFF_INBOX, subject, html, text });
}
