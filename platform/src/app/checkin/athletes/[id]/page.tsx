import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOsActor, assertAthleteAccess } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { auditLog } from "@/lib/audit";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { MediaStatusBadge } from "@/components/athlete/badges";
import { displayName, fullName } from "@/lib/athlete";

export const dynamic = "force-dynamic";

// The front-desk card for one athlete.
//
// Everything here answers a question someone is asking at the counter right
// now. Opening it writes an audit entry, because this screen shows a child's
// emergency and custody information and reading that should leave a trace.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-mid px-4 py-3.5 first:border-t-0">
      <p className="mb-1 font-sport text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-dark">
        {label}
      </p>
      <div className="font-body text-[15px] leading-snug text-near-black">{children}</div>
    </div>
  );
}

function Phone({ value }: { value: string }) {
  return (
    <a href={`tel:${value.replace(/[^0-9+]/g, "")}`} className="underline">
      {value}
    </a>
  );
}

export default async function CheckinAthletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getOsActor();
  await assertAthleteAccess(actor, id);

  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      grade: true,
      photoPath: true,
      hasMedicalInfo: true,
      medicalNotes: true,
      hasCustodyRestrictions: true,
      custodyRestrictions: true,
      custodyStaffInstruction: true,
      emergencyContact: true,
      emergencyContacts: { orderBy: { sortOrder: "asc" } },
      authorizedPickups: { where: { active: true } },
      mediaConsent: { select: { status: true } },
      // Deliberately absent: goal, coachingPreferences, competitiveMeter,
      // parentCoachNote, progressReports. None of it helps at the door, and a
      // lobby screen is the wrong place for a child's development notes.
      family: {
        select: {
          guardians: {
            include: { guardian: { select: { name: true, phone: true, email: true } } },
          },
        },
      },
    },
  });

  await auditLog(actor.id, "view_emergency_info", "athlete", athlete.id, { surface: "front_desk" });
  if (athlete.hasCustodyRestrictions && can(actor, "athletes.viewCustody")) {
    await auditLog(actor.id, "view_custody_restrictions", "athlete", athlete.id);
  }

  const pickupGuardians = athlete.family.guardians.filter((g) => g.authorizedForPickup);
  const notAuthorized = athlete.family.guardians.filter((g) => !g.authorizedForPickup);
  const photoUrl = await signedPhotoUrl(athlete.photoPath);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/checkin"
        className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
      >
        &larr; Front Desk
      </Link>

      <div className="flex items-center gap-4">
        <AthleteAvatar athlete={athlete} photoUrl={photoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-[24px] leading-tight font-black tracking-tight text-near-black">
            {fullName(athlete)}
          </h1>
          <p className="mt-0.5 font-body text-[14px] text-gray-dark">
            {[
              athlete.nickname ? `Goes by ${displayName(athlete)}` : null,
              athlete.grade ? `${athlete.grade} Grade` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {/* Safety first, literally — the two things that change what the desk
          does are at the top, not buried under contact details. */}
      {athlete.hasMedicalInfo && (
        <div className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3.5">
          <p className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-warning">
            Important Health Information
          </p>
          <p className="mt-1.5 font-body text-[15px] leading-snug text-near-black">
            {athlete.medicalNotes || "Flagged by the family — details not filled in yet."}
          </p>
        </div>
      )}

      {athlete.hasCustodyRestrictions && (
        <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3.5">
          <p className="font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
            Pickup Restriction
          </p>
          {athlete.custodyStaffInstruction && (
            <p className="mt-1.5 font-body text-[15px] font-bold leading-snug text-near-black">
              {athlete.custodyStaffInstruction}
            </p>
          )}
          {can(actor, "athletes.viewCustody") ? (
            <p className="mt-1.5 font-body text-[14px] leading-snug text-near-black">
              {athlete.custodyRestrictions}
            </p>
          ) : (
            <p className="mt-1.5 font-body text-[13.5px] text-gray-dark">
              Details are restricted. Check with an admin.
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
        <Row label="Emergency Contact">
          {athlete.emergencyContacts.length > 0 ? (
            athlete.emergencyContacts.map((c) => (
              <span key={c.id} className="block">
                {c.name} ({c.relationship}) · <Phone value={c.phone} />
              </span>
            ))
          ) : (
            <span>{athlete.emergencyContact || "None on file."}</span>
          )}
        </Row>

        <Row label="Parents + Guardians">
          {athlete.family.guardians.map((fg) => (
            <span key={fg.guardianId} className="block">
              {fg.guardian.name}
              {fg.relationship ? ` (${fg.relationship})` : ""}
              {fg.guardian.phone ? <> · <Phone value={fg.guardian.phone} /></> : null}
              {fg.isPrimary ? " · primary" : ""}
            </span>
          ))}
        </Row>

        <Row label="Authorized Pickup">
          {pickupGuardians.length === 0 && athlete.authorizedPickups.length === 0 ? (
            <span>Nobody listed.</span>
          ) : (
            <>
              {pickupGuardians.map((fg) => (
                <span key={fg.guardianId} className="block">
                  {fg.guardian.name}
                  {fg.relationship ? ` (${fg.relationship})` : ""}
                </span>
              ))}
              {athlete.authorizedPickups.map((p) => (
                <span key={p.id} className="block">
                  {p.name} ({p.relationship}) · <Phone value={p.phone} />
                  {p.note ? ` — ${p.note}` : ""}
                </span>
              ))}
            </>
          )}
          {/* Shown explicitly rather than by omission: "not on the list" and
              "specifically not allowed" look identical if you only print the
              allowed names, and they are not the same thing at a counter. */}
          {notAuthorized.length > 0 && (
            <span className="mt-1.5 block font-body text-[13.5px] text-danger">
              Not authorized: {notAuthorized.map((fg) => fg.guardian.name).join(", ")}
            </span>
          )}
        </Row>

        <Row label="Photos + Video">
          <MediaStatusBadge status={athlete.mediaConsent?.status ?? null} />
        </Row>
      </div>

      <p className="font-body text-[12.5px] text-gray-dark">
        Opening this record was recorded in the staff audit log.
      </p>
    </div>
  );
}
