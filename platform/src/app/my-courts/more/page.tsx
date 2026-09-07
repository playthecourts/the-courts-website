import Link from "next/link";
import { logout } from "@/app/actions/auth";

const LINKS = [
  { href: "/my-courts/memberships", label: "Your Training Plan" },
  { href: "/my-courts/league", label: "Fall League" },
  { href: "/my-courts/payments", label: "Payments" },
  { href: "/my-courts/waivers", label: "Waivers" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">More</h1>

      <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
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

      <p className="font-body text-xs text-gray-dark">
        Messages and account settings are coming soon.
      </p>

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
