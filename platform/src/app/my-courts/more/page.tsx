import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { unreadCountForFamily } from "@/lib/messaging";
import { logout } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/my-courts/memberships", label: "Your Training Plan" },
  { href: "/my-courts/league", label: "Fall League" },
  { href: "/my-courts/payments", label: "Payments" },
  { href: "/my-courts/waivers", label: "Waivers" },
];

export default async function MorePage() {
  const guardian = await getCurrentGuardian();
  const familyIds = guardian.families.map((fg) => fg.family.id);
  const unread = await unreadCountForFamily(guardian.id, familyIds);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">More</h1>

      <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
        {/* Messages sits first and carries its own count — an inbox nobody can
            see they have mail in is an inbox nobody opens. */}
        <Link
          href="/my-courts/messages"
          className="flex min-h-[52px] items-center justify-between px-4 font-heading font-bold text-black"
        >
          <span className="flex items-center gap-2">
            Messages
            {unread > 0 ? (
              <span className="rounded-full bg-orange px-2 py-0.5 font-sport text-[11px] font-bold uppercase tracking-wide text-white">
                {unread}
              </span>
            ) : null}
          </span>
          <span className="text-gray-dark">&rarr;</span>
        </Link>

        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-[52px] items-center justify-between px-4 font-heading font-bold text-black"
          >
            {link.label}
            <span className="text-gray-dark">&rarr;</span>
          </Link>
        ))}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-lg border border-gray-mid bg-white font-sport text-xs font-bold uppercase tracking-wide text-gray-dark"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
