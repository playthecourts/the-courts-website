import Link from "next/link";
import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { listAthleteRoster, type RosterFilters } from "@/lib/os/roster";
import { MediaStatusBadge } from "@/components/athlete/badges";
import { formatGrade } from "@/lib/coach-format";
import { PageHeader, Card, CardHeader, EmptyState, Pill, TableWrap, Th, Td } from "../_components/ui";

export const dynamic = "force-dynamic";

// The roster Part 1's audit flagged as the biggest real gap: "show me all
// 5th grade girls," "who hasn't signed a waiver," "who said no to photo
// permission" were only answerable via a direct database query before this.
// Fills the "Athletes + Families" nav slot (lib/os/nav.ts) that already
// pointed here — same families.view gate the sidebar already assumed.

const GRADES = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const SPORTS = ["Basketball", "Volleyball"];

export default async function FamiliesPage({ searchParams }: PageProps<"/os/families">) {
  const actor = await requireCapability("families.view");
  const seeSensitive = can(actor, "families.viewSensitive");
  const canExport = can(actor, "export.data");

  const sp = await searchParams;
  const filters: RosterFilters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    grade: typeof sp.grade === "string" ? sp.grade : undefined,
    gender: typeof sp.gender === "string" ? sp.gender : undefined,
    sport: typeof sp.sport === "string" ? sp.sport : undefined,
    waiverStatus: sp.waiver === "signed" || sp.waiver === "missing" ? sp.waiver : undefined,
    mediaStatus:
      sp.media === "media_ok" || sp.media === "media_limited" || sp.media === "media_no" || sp.media === "none"
        ? sp.media
        : undefined,
  };

  const rows = await listAthleteRoster(actor, filters);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries({
    q: filters.q,
    grade: filters.grade,
    gender: filters.gender,
    sport: filters.sport,
    waiver: filters.waiverStatus,
    media: filters.mediaStatus,
  })) {
    if (v) exportParams.set(k, v);
  }
  const exportHref = `/os/families/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Athletes + Families"
        subtitle="Every athlete, searchable and filterable — grade, sport, waiver status, photo permission."
        actions={
          canExport ? (
            <Link
              href={exportHref}
              className="os-heading inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black"
            >
              Export CSV
            </Link>
          ) : null
        }
      />

      <form method="get" action="/os/families" className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="q" className="os-eyebrow mb-1.5 block text-gray-dark">Search</label>
          <input
            id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Athlete or family name…"
            className="min-h-11 w-56 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="grade" className="os-eyebrow mb-1.5 block text-gray-dark">Grade</label>
          <select id="grade" name="grade" defaultValue={filters.grade ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">All grades</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="gender" className="os-eyebrow mb-1.5 block text-gray-dark">Gender</label>
          <select id="gender" name="gender" defaultValue={filters.gender ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">All</option>
            <option value="Boy">Boy</option>
            <option value="Girl">Girl</option>
          </select>
        </div>
        <div>
          <label htmlFor="sport" className="os-eyebrow mb-1.5 block text-gray-dark">Sport</label>
          <select id="sport" name="sport" defaultValue={filters.sport ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">All sports</option>
            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="waiver" className="os-eyebrow mb-1.5 block text-gray-dark">Waiver</label>
          <select id="waiver" name="waiver" defaultValue={filters.waiverStatus ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">Any</option>
            <option value="signed">Signed</option>
            <option value="missing">Missing</option>
          </select>
        </div>
        <div>
          <label htmlFor="media" className="os-eyebrow mb-1.5 block text-gray-dark">Photo/Video</label>
          <select id="media" name="media" defaultValue={filters.mediaStatus ?? ""} className="min-h-11 rounded-lg border border-gray-mid bg-white px-3 text-sm focus:border-orange focus:outline-none">
            <option value="">Any</option>
            <option value="media_ok">Media OK</option>
            <option value="media_limited">Ask First</option>
            <option value="media_no">No Media</option>
            <option value="none">Not Answered</option>
          </select>
        </div>
        <button type="submit" className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase tracking-wide hover:border-near-black">
          Apply
        </button>
        {hasFilters ? (
          <Link href="/os/families" className="os-eyebrow min-h-11 self-center text-orange underline underline-offset-2">
            Clear
          </Link>
        ) : null}
      </form>

      <Card>
        <CardHeader title="Roster" count={rows.length} />
        {rows.length === 0 ? (
          <EmptyState
            headline="Nobody matches."
            detail={hasFilters ? "No athletes match these filters. Try clearing one." : "No athletes on file yet."}
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>Family</Th>
                  <Th>Grade</Th>
                  <Th>Gender</Th>
                  <Th>Sport(s)</Th>
                  <Th>Age</Th>
                  <Th>Waiver</Th>
                  <Th>Photo/Video</Th>
                  <Th>Membership</Th>
                  {seeSensitive ? <Th>Guardian Contact</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="font-medium text-near-black">{r.firstName} {r.lastName}</span>
                    </Td>
                    <Td className="text-neutral">{r.familyName}</Td>
                    <Td>{formatGrade(r.grade) ?? "—"}</Td>
                    <Td>{r.gender ?? "—"}</Td>
                    <Td>{r.sports.join(", ") || "—"}</Td>
                    <Td className="os-num">{r.age}</Td>
                    <Td>
                      <Pill tone={r.waiverSigned ? "success" : "danger"}>
                        {r.waiverSigned ? "Signed" : "Missing"}
                      </Pill>
                    </Td>
                    <Td><MediaStatusBadge status={r.mediaStatus} /></Td>
                    <Td className="text-neutral">{r.membershipPlanName ?? "None"}</Td>
                    {seeSensitive ? (
                      <Td className="text-neutral">
                        {[r.guardianEmail, r.guardianPhone].filter(Boolean).join(" · ") || "—"}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
