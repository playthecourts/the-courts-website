import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/programs/format";

const BRAND_LOGO = "https://playthecourts.com/images/brand/logo-horizontal-full-color.png";

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

// Fires on payment_intent.payment_failed for a League PaymentIntent — the
// registration row already exists (created before Checkout by
// createLeaguePaymentIntent) but never moves past paymentStatus "pending" on
// its own. Without this, a declined card during League registration leaves
// no record anywhere that the attempt happened, if the family's browser
// session drops before confirmLeagueRegistration's client-side error
// handling can react.
export async function sendRegistrationPaymentFailedAlert(registrationId: string, declineReason: string | null) {
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
  const reason = declineReason ?? "Card declined";
  const subject = `Payment failed: ${athleteName} — ${offering.name}`;
  const text = `${athleteName} (${athlete.family.name})'s card was declined registering for ${offering.name} (${amount}).\n\nReason: ${reason}\n\nThe family sees this in the app and can retry — this is just so you know if they don't.\n\nView in Courts OS: ${registrationsUrl}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">Payment failed: ${athleteName}</p>
  <p style="font-size:13px;color:#343434;margin:0 0 16px;">${offering.name} · ${athlete.family.name} · ${amount}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#FDE7F0;border-left:3px solid #E0369D;padding:12px 16px;border-radius:6px;">
    ${reason}
  </p>
  <a href="${registrationsUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View in Courts OS &rarr;
  </a>
</div>`.trim();

  await sendEmail({ to: STAFF_INBOX, subject, html, text });
}

// The actual "you're confirmed" moment for a family — until this, a paid
// Fall League registration produced nothing but a bare Stripe receipt and
// whatever the app screen showed in the moment. Fires from the same
// synchronous success path as the registration write itself (not the
// webhook backstop), so it lands right after the charge, not on a delay.
export async function sendRegistrationConfirmationEmail(registrationId: string) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      amountCents: true,
      athlete: {
        select: {
          firstName: true,
          lastName: true,
          family: {
            select: {
              guardians: { select: { guardian: { select: { email: true, name: true } } } },
            },
          },
        },
      },
      offering: { select: { name: true, priceCents: true } },
    },
  });
  if (!registration) return;

  const { athlete, offering } = registration;
  const athleteName = `${athlete.firstName} ${athlete.lastName}`;
  const amount = formatCents(registration.amountCents ?? offering.priceCents);
  const leagueUrl = "https://app.playthecourts.com/my-courts/league";
  const subject = `You're registered — ${offering.name}`;
  const text = `${athleteName} is registered for ${offering.name}. You paid ${amount}.\n\nOur coaching team will follow up directly about team placement — no action needed from you right now.\n\nView your registration: ${leagueUrl}`;

  const confirmHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <img src="${BRAND_LOGO}" alt="The Courts" width="160" style="display:block;margin:0 0 28px;">

  <p style="font-size:20px;font-weight:700;margin:0 0 4px;">You&rsquo;re registered!</p>
  <p style="font-size:14px;color:#343434;margin:0 0 20px;">${athleteName} is signed up for ${offering.name}.</p>

  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    Paid ${amount}
  </p>

  <p style="font-size:14px;line-height:1.6;color:#343434;margin:0 0 24px;">
    Our coaching team will follow up directly about team placement — nothing else needed from you right now.
  </p>

  <a href="${leagueUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:14px 28px;border-radius:999px;">
    View Registration &rarr;
  </a>

  <p style="font-size:12px;color:#9A9A9A;margin:32px 0 0;border-top:1px solid #EAEAEA;padding-top:16px;">
    The Courts &middot; Nolensville, TN
  </p>
</div>`.trim();

  // A family is one guardian in the common case, but every guardian on the
  // family gets the same confirmation — whoever paid isn't necessarily the
  // only parent who should know their kid is registered.
  const recipients = athlete.family.guardians
    .map((fg) => fg.guardian.email)
    .filter((email): email is string => !!email);

  await Promise.all(recipients.map((to) => sendEmail({ to, subject, html: confirmHtml, text })));
}

// Fires once, right after a new guardian account is created (src/app/actions
// /auth.ts's signup()) — same best-effort/staff-inbox pattern as the alert
// above, since otherwise staff has no way to know a family signed up short of
// checking /os/families.
export async function sendNewAccountStaffAlert(guardianId: string) {
  const guardian = await prisma.guardian.findUnique({
    where: { id: guardianId },
    include: { families: { include: { family: { include: { athletes: true } } } } },
  });
  if (!guardian) return;

  const athleteNames = guardian.families.flatMap((fg) =>
    fg.family.athletes.map((a) => `${a.firstName} ${a.lastName}`)
  );
  const nextGenLabel =
    guardian.nextGenStatus === "current_nextgen"
      ? "Current NextGen"
      : guardian.nextGenStatus === "former_nextgen"
        ? "Former NextGen"
        : "New to The Courts";
  const familiesUrl = "https://app.playthecourts.com/os/families";

  const subject = `New account: ${guardian.name}`;
  const text = `${guardian.name} (${guardian.email}) created a Courts account.\nAthlete(s): ${
    athleteNames.join(", ") || "none yet"
  }\nNextGen: ${nextGenLabel}\n\nView in Courts OS: ${familiesUrl}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0D0D0D;">
  <p style="font-size:16px;font-weight:700;margin:0 0 4px;">New account: ${guardian.name}</p>
  <p style="font-size:13px;color:#343434;margin:0 0 16px;">${guardian.email} &middot; ${nextGenLabel}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#1A1A1A;background:#F2EDE7;border-left:3px solid #DE5019;padding:12px 16px;border-radius:6px;">
    Athlete(s): ${athleteNames.join(", ") || "none yet"}
  </p>
  <a href="${familiesUrl}" style="display:inline-block;background:#DE5019;color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:999px;">
    View in Courts OS &rarr;
  </a>
</div>`.trim();

  await sendEmail({ to: STAFF_INBOX, subject, html, text });
}
