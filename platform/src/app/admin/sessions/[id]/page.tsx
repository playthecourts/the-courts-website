import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { AttendanceRow } from "./attendance-row";

export default async function SessionRosterPage(props: PageProps<"/admin/sessions/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      program: true,
      team: true,
      bookings: {
        where: { status: { in: ["booked", "attended", "no_show"] } },
        include: { athlete: true },
        orderBy: { athlete: { firstName: "asc" } },
      },
      waitlistEntries: {
        where: { status: "waiting" },
        include: { athlete: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!session) notFound();

  return (
    <div>
      <Link href={`/admin/programs/${session.programId}`} className="mb-4 inline-block text-sm underline">
        ← {session.program.name}
      </Link>
      <h1 className="mb-1 text-xl font-bold">
        {new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(session.startTime)}
        {session.team && <span className="ml-2 font-normal text-neutral-500">· {session.team.name}</span>}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
          session.startTime
        )}
        –
        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
          session.endTime
        )}{" "}
        · {session.bookings.length}/{session.capacity} booked
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Roster</h2>
        <div className="rounded-lg border border-neutral-200">
          {session.bookings.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">No one booked yet.</p>
          ) : (
            session.bookings.map((booking) => (
              <AttendanceRow
                key={booking.id}
                bookingId={booking.id}
                sessionId={session.id}
                athleteName={`${booking.athlete.firstName} ${booking.athlete.lastName}`}
                status={booking.status}
              />
            ))
          )}
        </div>
      </section>

      {session.waitlistEntries.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Waitlist ({session.waitlistEntries.length})
          </h2>
          <div className="rounded-lg border border-neutral-200">
            {session.waitlistEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
                <span>
                  {entry.athlete.firstName} {entry.athlete.lastName}
                </span>
                <span className="text-neutral-500">#{entry.position}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
