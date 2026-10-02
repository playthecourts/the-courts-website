import { todaysClasses, formatClassTime } from "@/lib/checkin";
import { KioskApp, type KioskClass } from "./kiosk-app";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const classes = await todaysClasses({ kioskOnly: true });
  // Strip everything down to what a lobby screen may show before it leaves
  // the server: no surnames, grades, payment state or ids beyond the booking.
  const data: KioskClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    time: `${formatClassTime(c.startTime)}–${formatClassTime(c.endTime)}`,
    athletes: c.athletes
      .filter((a) => !a.absent)
      .map((a) => ({ bookingId: a.bookingId, name: a.kioskName, here: a.here })),
  }));
  return <KioskApp classes={data} />;
}
