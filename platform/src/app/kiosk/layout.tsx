import { redirect } from "next/navigation";
import { getOsActor } from "@/lib/os/dal";
import { isKioskDevice } from "@/lib/kiosk";

// The lobby iPad. Signed in as the staff member who switched Kiosk Mode on,
// but locked (proxy.ts) to this screen until someone exits with a staff
// password. Nothing here shows anything a lobby shouldn't see: class names,
// times, and first name + last initial.

export const metadata = { title: "Check In · The Courts" };

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  await getOsActor(); // signed-in staff device, or off to /login
  if (!(await isKioskDevice())) redirect("/checkin");

  return (
    <div className="min-h-screen select-none bg-near-black text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 md:px-10">{children}</main>
    </div>
  );
}
