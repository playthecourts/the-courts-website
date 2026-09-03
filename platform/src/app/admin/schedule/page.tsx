import Link from "next/link";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

function formatDateHeading(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function SchedulePage() {
  await getCurrentStaff();

  const sessions = await prisma.session.findMany({
    where: { startTime: { gte: new Date() }, status: "scheduled" },
    orderBy: { startTime: "asc" },
    include: { program: true },
  });

  const byDay = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.startTime.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(session);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Schedule</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming sessions scheduled.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byDay.entries()).map(([day, daySessions]) => (
            <div key={day}>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">
                {formatDateHeading(daySessions[0].startTime)}
              </h2>
              <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                {daySessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/admin/sessions/${session.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium">{session.program.name}</span>
                    <span className="text-neutral-500">
                      {formatTime(session.startTime)}–{formatTime(session.endTime)} · cap {session.capacity}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
