import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/athlete";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { PageHeader, Card, CardHeader, EmptyState, Pill, BTN, INPUT, SELECT, PAYMENT_TONE } from "../_components/ui";
import { createLeagueTeam, placeOnTeam, removeFromTeam } from "./actions";
import { JerseySelect } from "./jersey-select";

export const dynamic = "force-dynamic";

const JERSEY_SIZES = ["Youth Small", "Youth Medium", "Youth Large", "Youth XL", "Adult Small", "Adult Medium", "Adult Large"];

function formatPhone(raw: string | null) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// One line per guardian on file, so it can be copied straight into a group
// text — the whole reason this is shown here instead of just linking out
// to the family record.
function guardianPhones(athlete: { family: { guardians: { guardian: { name: string; phone: string | null } }[] } }) {
  return athlete.family.guardians
    .map((fg) => ({ name: fg.guardian.name, phone: formatPhone(fg.guardian.phone) }))
    .filter((g) => g.phone);
}

// Fall League placement: registered players on the left, team rosters below.
// Placing a player writes the same TeamMember row the parent's League page
// reads, so a family sees "Team Orange" the moment it's saved.

export default async function LeaguesPage() {
  const actor = await requireCapability("leagues.view");
  const canManage = can(actor, "leagues.manage");

  const offering = await prisma.offering.findFirst({ where: { name: "Fall 2026 Basketball League" } });
  if (!offering) {
    return (
      <>
        <PageHeader title="Leagues + Teams" />
        <EmptyState headline="No league set up" detail="The Fall 2026 Basketball League offering wasn't found." />
      </>
    );
  }

  const [teams, regRows] = await Promise.all([
    prisma.team.findMany({
      where: { offeringId: offering.id },
      orderBy: { createdAt: "asc" },
      include: {
        members: {
          include: {
            athlete: { include: { family: { include: { guardians: { include: { guardian: true } } } } } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
    prisma.registration.findMany({
      where: { offeringId: offering.id, status: { in: ["registered", "admin_review", "incomplete"] } },
    }),
  ]);
  const athletes = await prisma.athlete.findMany({
    where: { id: { in: regRows.map((r) => r.athleteId) } },
    include: { family: { include: { guardians: { include: { guardian: true } } } } },
  });
  const athleteById = new Map(athletes.map((a) => [a.id, a]));
  const registrations = regRows
    .map((r) => ({ ...r, athlete: athleteById.get(r.athleteId)! }))
    .filter((r) => r.athlete)
    .sort((a, b) => a.athlete.lastName.localeCompare(b.athlete.lastName));

  const placedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.athleteId)));
  const unplaced = registrations.filter((r) => !placedIds.has(r.athleteId));
  const teamOf = new Map(teams.flatMap((t) => t.members.map((m) => [m.athleteId, t.name] as const)));

  const allAthletesOnPage = [...teams.flatMap((t) => t.members.map((m) => m.athlete)), ...registrations.map((r) => r.athlete)];
  const photoUrls = await signedPhotoUrls(allAthletesOnPage.map((a) => a.photoPath));

  return (
    <>
      <PageHeader
        eyebrow="Fall League"
        title="Leagues + Teams"
        subtitle={`${registrations.length} registered · ${placedIds.size} placed · ${unplaced.length} waiting for a team`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {teams.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-mid px-4 py-3">
              <p className="font-display text-base font-bold text-near-black">{t.division ?? t.name}</p>
              <span className="shrink-0 text-neutral">{t.members.length}</span>
            </div>
            <ul className="divide-y divide-gray-mid">
              {t.members.length === 0 && <li className="px-4 py-4 text-sm text-gray-dark">No players yet.</li>}
              {t.members.map((m) => (
                <li key={m.athleteId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex items-center gap-2.5 text-sm text-near-black">
                    <AthleteAvatar athlete={m.athlete} photoUrl={m.athlete.photoPath ? (photoUrls.get(m.athlete.photoPath) ?? null) : null} size="sm" />
                    <span>
                    {displayName(m.athlete)} {m.athlete.lastName}
                    {guardianPhones(m.athlete).map((g) => (
                      <span key={g.name} className="mt-0.5 block text-xs font-normal text-gray-dark">
                        {g.name}
                        <span className="block">{g.phone}</span>
                      </span>
                    ))}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <JerseySelect athleteId={m.athleteId} sizes={JERSEY_SIZES} value={m.athlete.jerseySize} />
                    ) : (
                      <span className={`text-xs ${m.athlete.jerseySize ? "font-bold text-green-800" : "text-gray-dark"}`}>
                        {m.athlete.jerseySize ?? "No jersey size"}
                      </span>
                    )}
                    {canManage && (
                      <form action={removeFromTeam}>
                        <input type="hidden" name="athleteId" value={m.athleteId} />
                        <input type="hidden" name="teamId" value={t.id} />
                        <button className="text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-danger">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader title="Registered — Needs a Team" count={unplaced.length} />
        {unplaced.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-dark">Everyone registered has a team.</p>
        ) : (
          <ul className="divide-y divide-gray-mid">
            {unplaced.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2.5 text-sm text-near-black">
                  <AthleteAvatar athlete={r.athlete} photoUrl={r.athlete.photoPath ? (photoUrls.get(r.athlete.photoPath) ?? null) : null} size="sm" />
                  <span>
                  {displayName(r.athlete)} {r.athlete.lastName}
                  <span className="ml-2">
                    <Pill tone={PAYMENT_TONE[r.paymentStatus] ?? "neutral"}>{r.paymentStatus}</Pill>
                  </span>
                  {guardianPhones(r.athlete).map((g) => (
                    <span key={g.name} className="mt-0.5 block text-xs font-normal text-gray-dark">
                      {g.name}
                      <span className="block">{g.phone}</span>
                    </span>
                  ))}
                  </span>
                </span>
                {canManage && (
                  <form action={placeOnTeam} className="flex items-center gap-2">
                    <input type="hidden" name="athleteId" value={r.athleteId} />
                    <select name="teamId" required defaultValue="" className={SELECT}>
                      <option value="" disabled>Choose team…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button className={BTN.primary}>Place</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {registrations.some((r) => teamOf.has(r.athleteId)) && null}

      {canManage && (
        <Card className="mt-5">
          <CardHeader title="Add a Team" />
          <form action={createLeagueTeam} className="flex flex-wrap items-end gap-3 px-4 py-4">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-gray-dark">
              Team name
              <input name="name" required placeholder="Team Blue" className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-gray-dark">
              Division
              <input name="division" placeholder="3rd/4th Grade" className={INPUT} />
            </label>
            <button className={BTN.secondary}>Add Team</button>
          </form>
        </Card>
      )}
    </>
  );
}
