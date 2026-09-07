import Link from "next/link";
import { getOsActor } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { OsAccessError } from "@/lib/os/dal";

// Front Desk — checkin.playthecourts.com.
//
// A separate surface, NOT a separate system: every screen here reads the same
// Athlete rows the Parent App writes and the Coach App reads. There is no
// front-desk copy of a family anywhere.
//
// What makes it its own surface is the slice it shows. The desk needs logistics
// and safety — who is this, who may collect them, who do we call, is there an
// allergy, may we photograph them. It deliberately shows no skill metrics, no
// competitive meter and no coach development notes: none of that helps at the
// door, and all of it would be on screen in a lobby.

export default async function CheckinLayout({ children }: { children: React.ReactNode }) {
  const actor = await getOsActor();

  // The desk's whole purpose is the safety half of the record. A role without
  // it (marketing, finance) has no business on this surface at all.
  if (!can(actor, "families.viewSensitive")) {
    throw new OsAccessError("Front Desk is for desk and admin staff.");
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <header className="flex items-center justify-between border-b border-gray-mid bg-white px-5 py-3.5">
        <Link
          href="/checkin"
          className="font-display text-[17px] font-black uppercase tracking-tight text-near-black"
        >
          Front Desk
        </Link>
        <span className="font-sport text-[11px] font-bold uppercase tracking-[0.12em] text-gray-dark">
          {actor.name}
        </span>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
