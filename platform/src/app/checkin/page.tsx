import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOsActor, athleteScope } from "@/lib/os/dal";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { HealthAlertBadge, PickupRestrictionBadge, MediaStatusBadge } from "@/components/athlete/badges";
import { displayName, fullName } from "@/lib/athlete";

export const dynamic = "force-dynamic";

// Who's here today, and a name search for everyone else.
//
// The list leads with the face and the flags, because that is the order the
// desk actually needs them in: recognise the child, then know if there's
// anything to act on before the parent is halfway out the door.

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function CheckinPage(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getOsActor();
  const { q } = await props.searchParams;
  const query = (q ?? "").trim();

  const start = startOfToday();
  const end = new Date(start.getTime() + 86_400_000);

  const athleteSelect = {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    grade: true,
    photoPath: true,
    hasMedicalInfo: true,
    hasCustodyRestrictions: true,
    mediaConsent: { select: { status: true } },
  };

  const [todayBookings, searchResults] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        session: { startTime: { gte: start, lt: end } },
      },
      orderBy: { session: { startTime: "asc" } },
      include: {
        athlete: { select: athleteSelect },
        session: { include: { program: { select: { name: true } } } },
      },
    }),
    query.length >= 2
      ? prisma.athlete.findMany({
          // The actor's scope is composed into the query, so a head coach
          // searching here still can't reach another sport's families.
          where: {
            AND: [
              athleteScope(actor),
              {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                  { nickname: { contains: query, mode: "insensitive" } },
                ],
              },
            ],
          },
          select: athleteSelect,
          take: 20,
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const shown = query.length >= 2 ? searchResults : todayBookings.map((b) => b.athlete);
  const photoUrls = await signedPhotoUrls(shown.map((a) => a.photoPath));

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name…"
          className="min-h-[48px] flex-1 rounded-lg border border-gray-mid bg-white px-4 font-body text-[16px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-[48px] rounded-lg bg-orange px-5 font-sport text-[13px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
        >
          Search
        </button>
      </form>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h1 className="font-display text-[22px] font-black tracking-tight text-near-black">
            {query.length >= 2 ? "Search Results" : "Here Today"}
          </h1>
          {query.length >= 2 && (
            <Link
              href="/checkin"
              className="font-sport text-[11px] font-bold uppercase tracking-[0.12em] text-gray-dark hover:text-orange"
            >
              Clear
            </Link>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-mid bg-white px-4 py-6 text-center font-body text-[14px] text-gray-dark">
            {query.length >= 2 ? "Nobody by that name." : "Nothing on the schedule today."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((athlete) => (
              <li key={athlete.id}>
                <Link
                  href={`/checkin/athletes/${athlete.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-gray-mid bg-white px-4 py-3.5 hover:border-orange"
                >
                  <AthleteAvatar
                    athlete={athlete}
                    photoUrl={athlete.photoPath ? photoUrls.get(athlete.photoPath) : null}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-[15.5px] font-bold text-near-black">
                      {fullName(athlete)}
                    </span>
                    <span className="mt-0.5 block font-body text-[13px] text-gray-dark">
                      {[
                        athlete.nickname ? `"${displayName(athlete)}"` : null,
                        athlete.grade ? `${athlete.grade} Grade` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {athlete.hasMedicalInfo && <HealthAlertBadge />}
                      {athlete.hasCustodyRestrictions && <PickupRestrictionBadge />}
                      <MediaStatusBadge status={athlete.mediaConsent?.status ?? null} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
