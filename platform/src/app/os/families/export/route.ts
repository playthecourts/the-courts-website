import { NextResponse } from "next/server";
import { requireCapability, OsAccessError } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { listAthleteRoster, type RosterFilters } from "@/lib/os/roster";
import { auditLog } from "@/lib/audit";

// The CSV export half of the athlete roster (see ../page.tsx). A bulk export
// of potentially-sensitive data is a higher-risk action than viewing one
// record at a time, so — unlike the on-screen table — it's gated on
// export.data as well as families.view, and it's logged (auditLog), matching
// the athlete detail page's existing convention of logging sensitive-field
// access.

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsvRow(cells: (string | number | null)[]): string {
  return cells.map((c) => csvEscape(c === null ? "" : String(c))).join(",");
}

export async function GET(request: Request) {
  // A route handler has no React error boundary to catch OsAccessError the
  // way a page's error.tsx would — this needs a real HTTP response.
  let actor;
  try {
    actor = await requireCapability("families.view");
  } catch (err) {
    if (err instanceof OsAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
  if (!can(actor, "export.data")) {
    return NextResponse.json(
      { error: `Your role (${actor.role.replace("_", " ")}) can't export data.` },
      { status: 403 }
    );
  }
  const seeSensitive = can(actor, "families.viewSensitive");

  const url = new URL(request.url);
  const sp = url.searchParams;
  const filters: RosterFilters = {
    q: sp.get("q") ?? undefined,
    grade: sp.get("grade") ?? undefined,
    gender: sp.get("gender") ?? undefined,
    sport: sp.get("sport") ?? undefined,
    waiverStatus: sp.get("waiver") === "signed" || sp.get("waiver") === "missing" ? (sp.get("waiver") as "signed" | "missing") : undefined,
    mediaStatus:
      (["media_ok", "media_limited", "media_no", "none"] as const).includes(sp.get("media") as never)
        ? (sp.get("media") as RosterFilters["mediaStatus"])
        : undefined,
  };

  const rows = await listAthleteRoster(actor, filters, { forExport: true });

  const header = [
    "First Name", "Last Name", "Family", "Grade", "Gender", "Sport(s)", "Age",
    "Waiver Signed", "Media Status", "Membership Plan",
    ...(seeSensitive ? ["Date of Birth", "Guardian Email", "Guardian Phone"] : []),
  ];

  const lines = [toCsvRow(header)];
  for (const r of rows) {
    lines.push(
      toCsvRow([
        r.firstName,
        r.lastName,
        r.familyName,
        r.grade,
        r.gender,
        r.sports.join("; "),
        r.age,
        r.waiverSigned ? "Signed" : "Missing",
        r.mediaStatus ?? "Not Answered",
        r.membershipPlanName ?? "None",
        ...(seeSensitive
          ? [r.dob ? r.dob.toISOString().slice(0, 10) : "", r.guardianEmail, r.guardianPhone]
          : []),
      ])
    );
  }

  await auditLog(actor.id, "export_athlete_roster", "athlete_roster", null, {
    rowCount: rows.length,
    filters,
    includedSensitiveFields: seeSensitive,
  });

  const csv = lines.join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="athlete-roster-${date}.csv"`,
    },
  });
}
