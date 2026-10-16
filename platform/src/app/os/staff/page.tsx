import { requireCapability } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { prisma } from "@/lib/prisma";
import { facilityNow } from "@/lib/facility-time";
import { PageHeader, Card, CardHeader, Pill, TableWrap, Th, Td, BTN, SELECT, ErrorNote, SuccessNote } from "../_components/ui";
import { mergeStaff, setStaffActive } from "./actions";

export const dynamic = "force-dynamic";

const COACH_SIGNUP_URL = "https://app.playthecourts.com/coach/signup";

type AuthRow = { id: string; last_sign_in_at: Date | null; email_confirmed_at: Date | null };

// Login status lives in Supabase's auth.users, not in our staff table. Read it
// straight from the same database; if the connection's role can't see the
// auth schema, the page still renders and says "Unknown" rather than failing.
async function loadAuthRows(authIds: string[]): Promise<Map<string, AuthRow> | null> {
  const uuids = authIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  if (uuids.length === 0) return new Map();
  try {
    const rows = await prisma.$queryRaw<AuthRow[]>`
      SELECT id::text AS id, last_sign_in_at, email_confirmed_at
      FROM auth.users
      WHERE id = ANY(${uuids}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, r]));
  } catch {
    return null;
  }
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(d);
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  head_coach: "Head Coach",
  coach: "Coach",
  front_desk: "Front Desk",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ merged?: string; error?: string }>;
}) {
  const actor = await requireCapability("coaches.view");
  const canManage = can(actor, "staff.manage");
  const { merged, error } = await searchParams;
  const now = facilityNow();

  const staff = await prisma.staffUser.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      authId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      sports: true,
      active: true,
      createdAt: true,
      _count: {
        select: {
          sessionAssignments: { where: { session: { status: "scheduled", startTime: { gte: now } } } },
          teamAssignments: true,
        },
      },
    },
  });

  const auth = await loadAuthRows(staff.map((s) => s.authId));

  function loginStatus(authId: string): { label: string; tone: "success" | "warning" | "neutral" | "danger"; detail?: string } {
    if (!auth) return { label: "Unknown", tone: "neutral" };
    const row = auth.get(authId);
    if (!row) return { label: "No login", tone: "danger", detail: "Profile made by admin — never signed up" };
    if (row.last_sign_in_at) return { label: "Signed in", tone: "success", detail: `Last ${fmtDate(row.last_sign_in_at)}` };
    if (!row.email_confirmed_at) return { label: "Unconfirmed", tone: "warning", detail: "Hasn't confirmed their email" };
    return { label: "Never signed in", tone: "warning" };
  }

  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  // Possible duplicates: active profiles sharing a first name.
  const groups = new Map<string, typeof active>();
  for (const s of active) {
    const k = firstName(s.name);
    if (!k || k === "staff") continue;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1);
  const dupeIds = new Set(dupes.flat().map((s) => s.id));

  // Suggest which profile to keep: the one with a real login (most recent
  // sign-in wins), then the owner/admin, then the fuller name.
  function suggestKeeper(group: typeof active) {
    return [...group].sort((a, b) => {
      const la = auth?.get(a.authId)?.last_sign_in_at?.getTime() ?? -1;
      const lb = auth?.get(b.authId)?.last_sign_in_at?.getTime() ?? -1;
      if (la !== lb) return lb - la;
      const ra = a.role === "owner" || a.role === "admin" ? 1 : 0;
      const rb = b.role === "owner" || b.role === "admin" ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return b.name.length - a.name.length;
    })[0];
  }

  const signedIn = auth ? active.filter((s) => auth.get(s.authId)?.last_sign_in_at).length : null;

  return (
    <>
      <PageHeader
        eyebrow="Courts OS"
        title="Staff"
        subtitle="Every coach and staff profile, whether they've actually logged in, and any duplicates to clean up."
      />

      <div className="mb-6 flex flex-col gap-3">
        {merged ? <SuccessNote>{merged}</SuccessNote> : null}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {auth === null ? (
          <ErrorNote>Couldn&rsquo;t read login status from the auth database, so it shows as Unknown.</ErrorNote>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="os-eyebrow text-neutral">Active profiles</p>
          <p className="os-display os-num mt-2 text-3xl leading-none text-near-black">{active.length}</p>
        </Card>
        <Card className="p-4">
          <p className="os-eyebrow text-neutral">Have signed in</p>
          <p className="os-display os-num mt-2 text-3xl leading-none text-near-black">{signedIn ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="os-eyebrow text-neutral">Coach sign-up link</p>
          <p className="mt-2 break-all text-sm font-semibold text-orange">{COACH_SIGNUP_URL}</p>
          <p className="mt-1 text-xs text-gray-dark">Send this to new coaches. Merge any duplicate it creates below.</p>
        </Card>
      </div>

      {dupes.length > 0 ? (
        <Card className="mb-6 border-warning/40">
          <CardHeader title="Possible duplicates" count={dupes.length} />
          <div className="divide-y divide-gray-mid">
            {dupes.map((group) => {
              const keeper = suggestKeeper(group);
              return (
                <div key={keeper.id} className="px-4 py-4">
                  <ul className="mb-3 space-y-1 text-sm">
                    {group.map((s) => {
                      const st = loginStatus(s.authId);
                      return (
                        <li key={s.id} className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-near-black">{s.name}</span>
                          <span className="text-gray-dark">{s.email}</span>
                          <Pill tone={st.tone}>{st.label}</Pill>
                          <span className="text-xs text-neutral">
                            {s._count.sessionAssignments} upcoming session{s._count.sessionAssignments === 1 ? "" : "s"}
                          </span>
                          {s.id === keeper.id ? <Pill tone="brand">Suggested keep</Pill> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {canManage ? (
                    group
                      .filter((s) => s.id !== keeper.id)
                      .map((s) => (
                        <form key={s.id} action={mergeStaff} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="dropId" value={s.id} />
                          <span className="text-sm text-gray-dark">Merge {s.name} ({s.email}) into</span>
                          <select name="keepId" defaultValue={keeper.id} className={`${SELECT} w-auto min-w-56`}>
                            {group
                              .filter((o) => o.id !== s.id)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name} — {o.email}
                                </option>
                              ))}
                          </select>
                          <button type="submit" className={BTN.primary}>
                            Merge
                          </button>
                        </form>
                      ))
                  ) : (
                    <p className="text-xs text-gray-dark">Only the owner can merge profiles.</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="border-t border-gray-mid px-4 py-3 text-xs text-gray-dark">
            Merging moves the duplicate&rsquo;s classes, teams, availability and coverage onto the profile you keep, then
            deactivates the duplicate. Keep the one the coach actually logs in with.
          </p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader title="Active" count={active.length} />
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-gray-mid">
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Login</Th>
                <Th>Upcoming sessions</Th>
                <Th>Added</Th>
                {canManage ? <Th>{""}</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-mid">
              {active.map((s) => {
                const st = loginStatus(s.authId);
                return (
                  <tr key={s.id}>
                    <Td>
                      <p className="font-semibold text-near-black">
                        {s.name}
                        {dupeIds.has(s.id) ? <span className="ml-2 text-xs font-normal text-warning">possible duplicate</span> : null}
                      </p>
                      <p className="text-xs text-gray-dark">
                        {s.email}
                        {s.phone ? ` · ${s.phone}` : ""}
                      </p>
                      {s.sports.length ? <p className="text-xs text-neutral">{s.sports.join(", ")}</p> : null}
                    </Td>
                    <Td>{ROLE_LABEL[s.role] ?? s.role}</Td>
                    <Td>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {st.detail ? <p className="mt-1 text-xs text-neutral">{st.detail}</p> : null}
                    </Td>
                    <Td className="os-num">
                      {s._count.sessionAssignments}
                      {s._count.teamAssignments ? (
                        <span className="ml-1 text-xs text-neutral">
                          + {s._count.teamAssignments} team{s._count.teamAssignments === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-gray-dark">{fmtDate(s.createdAt)}</Td>
                    {canManage ? (
                      <Td className="text-right">
                        {s.id !== actor.id ? (
                          <form action={setStaffActive}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="active" value="false" />
                            <button type="submit" className={BTN.ghost}>
                              Deactivate
                            </button>
                          </form>
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {inactive.length > 0 ? (
        <Card>
          <CardHeader title="Inactive" count={inactive.length} />
          <ul className="divide-y divide-gray-mid">
            {inactive.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-dark">{s.name}</p>
                  <p className="text-xs text-neutral">{s.email}</p>
                </div>
                {canManage ? (
                  <form action={setStaffActive}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value="true" />
                    <button type="submit" className={BTN.secondary}>
                      Reactivate
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
