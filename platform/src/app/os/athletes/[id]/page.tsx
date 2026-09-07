import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOsActor, assertAthleteAccess } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { auditLog } from "@/lib/audit";
import { signedPhotoUrl } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { MediaStatusBadge } from "@/components/athlete/badges";
import {
  displayName,
  fullName,
  birthdayMonth,
  ageFrom,
  coachingPreferenceLabels,
  competitiveMeterLabel,
} from "@/lib/athlete";
import { quarterLabel } from "@/lib/quarters";
import { PageHeader, Card, CardHeader, Pill, EmptyState } from "../../_components/ui";
import PickupInstructionForm from "./pickup-instruction-form";

export const dynamic = "force-dynamic";

// The complete athlete record, section by section — and the only place in the
// platform where "complete" is available at all.
//
// Each sensitive section is gated on its own capability rather than on "is an
// admin", so the same page shows a front-desk lead the safety half and shows a
// head coach neither the custody text nor the DOB. Sections a role can't hold
// are not rendered at all: no greyed-out teaser that tells them what exists.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-gray-mid px-4 py-3 first:border-t-0 sm:flex-row sm:gap-4">
      <span className="font-sport text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-dark sm:w-48 sm:shrink-0 sm:pt-0.5">
        {label}
      </span>
      <span className="font-body text-[14.5px] leading-snug text-near-black">{children}</span>
    </div>
  );
}

const STATUS_TONE = {
  draft: "neutral",
  ready_for_review: "warning",
  published: "success",
} as const;

export default async function OsAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getOsActor();
  await assertAthleteAccess(actor, id);

  const seeSensitive = can(actor, "families.viewSensitive");
  const seeCustody = can(actor, "athletes.viewCustody");
  const seeAudit = can(actor, "audit.view");

  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id },
    include: {
      family: { include: { guardians: { include: { guardian: true } } } },
      emergencyContacts: { orderBy: { sortOrder: "asc" } },
      authorizedPickups: { where: { active: true } },
      mediaConsent: { include: { guardian: { select: { name: true } } } },
      mediaConsentChanges: { orderBy: { createdAt: "desc" }, take: 10 },
      progressReports: { orderBy: [{ year: "desc" }, { quarter: "desc" }] },
      evaluations: {
        orderBy: { createdAt: "desc" },
        include: { staff: { select: { name: true } }, program: { select: { name: true } } },
      },
      profileChanges: seeAudit
        ? { orderBy: { createdAt: "desc" }, take: 40 }
        : { where: { id: "none" } },
    },
  });

  if (seeSensitive) {
    await auditLog(actor.id, "view_emergency_info", "athlete", athlete.id, { surface: "os" });
  }
  if (seeCustody && athlete.hasCustodyRestrictions) {
    await auditLog(actor.id, "view_custody_restrictions", "athlete", athlete.id);
  }

  const photoUrl = await signedPhotoUrl(athlete.photoPath);
  const prefs = coachingPreferenceLabels(athlete.coachingPreferences);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Athlete Record"
        title={fullName(athlete)}
        subtitle={[
          athlete.nickname ? `Goes by ${displayName(athlete)}` : null,
          athlete.grade ? `${athlete.grade} Grade` : null,
          athlete.sports.join(" · ") || null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="flex items-center gap-4">
        <AthleteAvatar athlete={athlete} photoUrl={photoUrl} size="lg" />
        <div className="flex flex-wrap gap-1.5">
          <MediaStatusBadge status={athlete.mediaConsent?.status ?? null} />
          {athlete.hasMedicalInfo && <Pill tone="warning">Health Info</Pill>}
          {athlete.hasCustodyRestrictions && <Pill tone="danger">Custody Restriction</Pill>}
        </div>
      </div>

      <Card>
        <CardHeader title="General Profile" />
        <Row label="Full Name">{fullName(athlete)}</Row>
        {athlete.nickname && <Row label="Nickname">{athlete.nickname}</Row>}
        {/* DOB is sensitive: full date only for roles holding the sensitive
            capability; everyone else gets what they operationally need. */}
        <Row label="Date of Birth">
          {seeSensitive
            ? `${athlete.dob.toISOString().slice(0, 10)} · age ${ageFrom(athlete.dob)}`
            : `Age ${ageFrom(athlete.dob)} · born ${birthdayMonth(athlete.dob)}`}
        </Row>
        <Row label="Grade">{athlete.grade ?? "—"}</Row>
        <Row label="School">{athlete.school ?? "—"}</Row>
        <Row label="Sports">{athlete.sports.join(" · ") || "—"}</Row>
        {athlete.favoriteSport && <Row label="Favorite Sport">{athlete.favoriteSport}</Row>}
        <Row label="Family">
          <Link href={`/os/families/${athlete.familyId}`} className="underline">
            {athlete.family.name}
          </Link>
        </Row>
      </Card>

      <Card>
        <CardHeader title="Coaching" />
        <Row label="Working On">{athlete.goal ?? "—"}</Row>
        <Row label="Likes to Be Coached">{prefs.join(" · ") || "—"}</Row>
        <Row label="Competitive Meter">
          {competitiveMeterLabel(athlete.competitiveMeter) ?? "—"}
        </Row>
        <Row label="Other Sports">{athlete.otherSports.join(" · ") || "—"}</Row>
        <Row label="Parent Note to Coaches">{athlete.parentCoachNote ?? "—"}</Row>
      </Card>

      <Card>
        <CardHeader
          title="Progress"
          action={
            <Link href="/os/progress" className="os-eyebrow text-orange hover:underline">
              All Reports →
            </Link>
          }
        />
        {athlete.progressReports.length === 0 ? (
          <EmptyState headline="No reports yet" detail="Coaches write these each quarter." />
        ) : (
          athlete.progressReports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 border-t border-gray-mid px-4 py-3 first:border-t-0"
            >
              <span className="font-body text-[14.5px] text-near-black">
                {quarterLabel(r)} · {r.sport}
              </span>
              <Pill tone={STATUS_TONE[r.status]}>{r.status.replace(/_/g, " ")}</Pill>
            </div>
          ))
        )}
      </Card>

      <Card>
        <CardHeader title="Evaluations" />
        {athlete.evaluations.length === 0 ? (
          <EmptyState headline="No evaluations" detail="Initial, league and skills evaluations appear here." />
        ) : (
          athlete.evaluations.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 border-t border-gray-mid px-4 py-3 first:border-t-0"
            >
              <span className="min-w-0 font-body text-[14.5px] text-near-black">
                {e.evaluationType.replace(/_/g, " ")}
                {e.program ? ` · ${e.program.name}` : ""}
                <span className="block font-body text-[12.5px] text-gray-dark">{e.staff.name}</span>
              </span>
              {/* Internal by default, and labelled as such — a league
                  evaluation's placement talk is not a parent document. */}
              <Pill tone={e.visibility === "share_with_parent" ? "success" : "neutral"}>
                {e.visibility === "share_with_parent" ? "Shared" : "Internal Only"}
              </Pill>
            </div>
          ))
        )}
      </Card>

      {seeSensitive && (
        <Card>
          <CardHeader title="Safety + Emergency" />
          <Row label="Health Information">
            {athlete.hasMedicalInfo ? (athlete.medicalNotes ?? "Flagged, no detail on file") : "None reported"}
          </Row>
          <Row label="Emergency Contacts">
            {athlete.emergencyContacts.length > 0
              ? athlete.emergencyContacts.map((c) => (
                  <span key={c.id} className="block">
                    {c.name} ({c.relationship}) · {c.phone}
                  </span>
                ))
              : (athlete.emergencyContact ?? "None on file")}
          </Row>
          {seeCustody && (
            <>
              <Row label="Custody / Contact Restrictions">
                {athlete.hasCustodyRestrictions ? (athlete.custodyRestrictions ?? "Flagged") : "None reported"}
              </Row>
              {athlete.hasCustodyRestrictions && (
                <div className="border-t border-gray-mid">
                  <PickupInstructionForm
                    athleteId={athlete.id}
                    current={athlete.custodyStaffInstruction}
                  />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {seeSensitive && (
        <Card>
          <CardHeader title="Guardians" />
          {athlete.family.guardians.map((fg) => (
            <Row key={fg.guardianId} label={fg.relationship ?? "Guardian"}>
              {fg.guardian.name}
              {fg.guardian.email ? ` · ${fg.guardian.email}` : ""}
              {fg.guardian.phone ? ` · ${fg.guardian.phone}` : ""}
              {fg.isPrimary ? " · primary" : ""}
              {fg.guardian.authId ? "" : " · no login yet"}
            </Row>
          ))}
        </Card>
      )}

      {seeSensitive && (
        <Card>
          <CardHeader title="Authorized Pickup" />
          {athlete.family.guardians
            .filter((fg) => fg.authorizedForPickup)
            .map((fg) => (
              <Row key={fg.guardianId} label={fg.relationship ?? "Guardian"}>
                {fg.guardian.name}
              </Row>
            ))}
          {athlete.authorizedPickups.map((p) => (
            <Row key={p.id} label={p.relationship}>
              {p.name} · {p.phone}
              {p.note ? ` — ${p.note}` : ""}
            </Row>
          ))}
          {athlete.family.guardians.every((fg) => !fg.authorizedForPickup) &&
            athlete.authorizedPickups.length === 0 && (
              <EmptyState headline="Nobody listed" detail="No authorized pickup people on file." />
            )}
        </Card>
      )}

      <Card>
        <CardHeader title="Privacy + Permissions" />
        <Row label="Photos + Video">
          <MediaStatusBadge status={athlete.mediaConsent?.status ?? null} />
        </Row>
        {athlete.mediaConsent && seeSensitive && (
          <>
            <Row label="Agreed By">
              {athlete.mediaConsent.guardianName} ({athlete.mediaConsent.guardianRelationship})
            </Row>
            <Row label="Date">{athlete.mediaConsent.consentDate.toISOString().slice(0, 10)}</Row>
            <Row label="Release Version">{athlete.mediaConsent.releaseVersion}</Row>
          </>
        )}
        {athlete.mediaConsentChanges.length > 0 && seeSensitive && (
          <Row label="Change History">
            {athlete.mediaConsentChanges.map((c) => (
              <span key={c.id} className="block">
                {c.createdAt.toISOString().slice(0, 10)} · {c.oldStatus ?? "not set"} →{" "}
                {c.newStatus}
                {c.needsFollowUp && !c.followUpDoneAt ? " · follow-up open" : ""}
              </span>
            ))}
          </Row>
        )}
      </Card>

      {seeAudit && (
        <Card>
          <CardHeader
            title="Audit History"
            action={<span className="os-eyebrow text-gray-dark">Last 40 changes</span>}
          />
          {athlete.profileChanges.length === 0 ? (
            <EmptyState headline="No changes recorded" detail="Edits to this profile will appear here." />
          ) : (
            athlete.profileChanges.map((c) => (
              <div key={c.id} className="border-t border-gray-mid px-4 py-2.5 first:border-t-0">
                <p className="font-body text-[13.5px] text-near-black">
                  <span className="font-sport text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-dark">
                    {c.category.replace(/_/g, " ")}
                  </span>{" "}
                  {c.field.replace(/_/g, " ")}
                  {c.oldValue || c.newValue ? `: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}` : ""}
                </p>
                <p className="font-body text-[12px] text-gray-dark">
                  {c.actorLabel} ({c.actorType}) · {c.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </p>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
