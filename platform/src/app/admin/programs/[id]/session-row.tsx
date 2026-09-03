"use client";

import { cancelSession, deleteSession } from "@/app/admin/programs/actions";

type Session = {
  id: string;
  programId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  status: string;
};

function formatRange(start: Date, end: Date) {
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export function SessionRow({ session }: { session: Session }) {
  const cancelAction = cancelSession.bind(null, session.id, session.programId);
  const deleteAction = deleteSession.bind(null, session.id, session.programId);

  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm">
      <div>
        <span className={session.status === "cancelled" ? "text-neutral-400 line-through" : ""}>
          {formatRange(session.startTime, session.endTime)}
        </span>
        <span className="ml-2 text-neutral-500">cap {session.capacity}</span>
        {session.status === "cancelled" && (
          <span className="ml-2 text-xs text-red-500">cancelled</span>
        )}
      </div>
      <div className="flex gap-3">
        {session.status !== "cancelled" && (
          <form action={cancelAction}>
            <button type="submit" className="font-medium underline">
              Cancel
            </button>
          </form>
        )}
        <form action={deleteAction}>
          <button type="submit" className="font-medium text-red-600 underline">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
