"use client";

import { cancelReservation } from "@/app/admin/resources/actions";

function formatRange(start: Date, end: Date) {
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

export function ReservationRow({
  reservationId,
  resourceId,
  familyName,
  startTime,
  endTime,
  status,
}: {
  reservationId: string;
  resourceId: string;
  familyName: string;
  startTime: Date;
  endTime: Date;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 text-sm last:border-b-0">
      <div>
        <span className={status === "cancelled" ? "text-neutral-400 line-through" : ""}>
          {formatRange(startTime, endTime)}
        </span>
        <span className="ml-2 text-neutral-500">{familyName}</span>
        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">rental</span>
        {status === "cancelled" && <span className="ml-2 text-xs text-red-500">cancelled</span>}
      </div>
      {status !== "cancelled" && (
        <button
          onClick={() => cancelReservation(reservationId, resourceId)}
          className="text-xs font-medium text-red-600 underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
