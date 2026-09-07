import Link from "next/link";
import { PROGRAM_TYPE_LABELS, gradeRange, time, timeRange } from "@/lib/os/format";
import { Pill } from "./ui";

type SessionLike = {
  id: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  status: string;
  booked: number;
  openSpots: number;
  isFull: boolean;
  program: {
    id: string;
    name: string;
    sport: string | null;
    programType: string;
    gradeMin: number | null;
    gradeMax: number | null;
  };
  resource: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  coaches: { role: string; staff: { id: string; name: string } }[];
};

/// One session, as it reads on Today and in the day view: time, what it is,
/// who's coaching, where, and how full. Fill is shown as "8 / 8" plus a word,
/// because "8 / 8" alone doesn't say whether that's good or a problem.
export function SessionRow({ session: s }: { session: SessionLike }) {
  const cancelled = s.status === "cancelled";
  const lead = s.coaches.find((c) => c.role === "lead") ?? s.coaches[0];
  const grades = gradeRange(s.program.gradeMin, s.program.gradeMax);

  return (
    <li className={cancelled ? "opacity-60" : undefined}>
      <Link
        href={`/os/sessions/${s.id}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-warm-stone"
      >
        <span className="os-display os-num w-20 shrink-0 text-lg text-near-black">
          {time(s.startTime)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="os-heading text-sm text-near-black">{s.program.name}</span>
            {cancelled ? <Pill tone="danger">Cancelled</Pill> : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-dark">
            <span>{PROGRAM_TYPE_LABELS[s.program.programType] ?? s.program.programType}</span>
            {grades ? <span aria-hidden="true">·</span> : null}
            {grades ? <span>{grades}</span> : null}
            {s.team ? <span aria-hidden="true">·</span> : null}
            {s.team ? <span>{s.team.name}</span> : null}
            <span aria-hidden="true">·</span>
            <span>{timeRange(s.startTime, s.endTime)}</span>
          </span>
        </span>

        <span className="w-28 shrink-0 text-xs text-gray-dark">
          {s.resource?.name ?? <span className="text-neutral">No court set</span>}
        </span>

        <span className="w-32 shrink-0 text-xs text-gray-dark">
          {lead ? (
            lead.staff.name
          ) : s.program.programType === "rental" || s.program.programType === "resource" ? (
            <span className="text-neutral">—</span>
          ) : (
            <span className="text-warning">No coach</span>
          )}
        </span>

        <span className="w-24 shrink-0 text-right">
          <span className="os-num os-heading text-sm text-near-black">
            {s.booked} / {s.capacity}
          </span>
          <span className="mt-0.5 block">
            {cancelled ? null : s.isFull ? (
              <Pill tone="neutral">Full</Pill>
            ) : s.openSpots <= 2 ? (
              <Pill tone="warning">{s.openSpots} left</Pill>
            ) : (
              <Pill tone="success">{s.openSpots} open</Pill>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
