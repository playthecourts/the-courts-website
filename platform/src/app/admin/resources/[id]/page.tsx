import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { updateResource } from "@/app/admin/resources/actions";
import { NewReservationForm } from "./new-reservation-form";
import { ReservationRow } from "./reservation-row";

function formatSessionRange(start: Date, end: Date) {
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export default async function ResourceDetailPage(props: PageProps<"/admin/resources/[id]">) {
  await getCurrentStaff();
  const { id } = await props.params;

  const [resource, families] = await Promise.all([
    prisma.resource.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { status: "scheduled", startTime: { gte: new Date() } },
          orderBy: { startTime: "asc" },
          include: { program: true },
        },
        reservations: {
          where: { startTime: { gte: new Date() } },
          orderBy: { startTime: "asc" },
          include: { family: true },
        },
      },
    }),
    prisma.family.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!resource) notFound();

  const updateAction = updateResource.bind(null, resource.id);

  return (
    <div className="flex flex-col gap-8">
      <form action={updateAction} className="flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            name="name"
            defaultValue={resource.name}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-lg font-bold"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <input
            name="resourceType"
            defaultValue={resource.resourceType}
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Capacity
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={resource.capacity}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white">
          Save
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Upcoming Bookings
        </h2>
        <div className="mb-4 rounded-lg border border-neutral-200">
          {resource.sessions.length === 0 && resource.reservations.length === 0 ? (
            <p className="px-4 py-3 text-sm text-neutral-500">Nothing booked yet.</p>
          ) : (
            <>
              {resource.sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/sessions/${session.id}`}
                  className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0 hover:bg-neutral-50"
                >
                  <span>
                    <span className="underline">{formatSessionRange(session.startTime, session.endTime)}</span>
                    <span className="ml-2 text-neutral-500">{session.program.name}</span>
                  </span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">program</span>
                </Link>
              ))}
              {resource.reservations.map((reservation) => (
                <ReservationRow
                  key={reservation.id}
                  reservationId={reservation.id}
                  resourceId={resource.id}
                  familyName={reservation.family.name}
                  startTime={reservation.startTime}
                  endTime={reservation.endTime}
                  status={reservation.status}
                />
              ))}
            </>
          )}
        </div>
        <NewReservationForm resourceId={resource.id} families={families} />
      </section>
    </div>
  );
}
