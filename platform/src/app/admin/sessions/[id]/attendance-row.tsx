"use client";

import { markAttendance } from "@/app/admin/sessions/actions";

type Props = {
  bookingId: string;
  sessionId: string;
  athleteName: string;
  status: string;
};

export function AttendanceRow({ bookingId, sessionId, athleteName, status }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm">
      <span className="font-medium">{athleteName}</span>
      <div className="flex items-center gap-2">
        <span
          className={
            status === "attended"
              ? "text-xs font-semibold text-green-700"
              : status === "no_show"
                ? "text-xs font-semibold text-red-600"
                : "text-xs text-neutral-500"
          }
        >
          {status === "booked" ? "Not marked" : status.replace("_", " ")}
        </span>
        <button
          onClick={() => markAttendance(bookingId, sessionId, "attended")}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
        >
          Present
        </button>
        <button
          onClick={() => markAttendance(bookingId, sessionId, "no_show")}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50"
        >
          No-show
        </button>
      </div>
    </div>
  );
}
