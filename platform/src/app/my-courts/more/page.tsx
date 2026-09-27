import Link from "next/link";
import { SignOutNavItem, Icon } from "../nav-link";

// The catch-all for everything real but not frequent enough to earn its own
// tab: Payments, Waivers, Messages, Settings. Messages in particular had
// zero links to it anywhere in the app before this page existed — this is
// its first real entry point.
const MORE_ITEMS = [
  {
    href: "/my-courts/messages",
    icon: "messages" as const,
    label: "Messages",
    desc: "Threads with coaches and staff.",
  },
  {
    href: "/my-courts/payments",
    icon: "payments" as const,
    label: "Payments",
    desc: "Payment and booking history.",
  },
  {
    href: "/my-courts/waivers",
    icon: "waivers" as const,
    label: "Waivers + Permissions",
    desc: "Required forms and Photo/Video permission.",
  },
  {
    href: "/my-courts/settings",
    icon: "training" as const,
    label: "Account Settings",
    desc: "Your login and account details.",
  },
];

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">More</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">Everything else about your account.</p>
      </div>

      <div className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
        {MORE_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-gray-light"
          >
            <Icon name={item.icon} active={false} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-bold text-near-black">{item.label}</span>
              <span className="block font-body text-xs text-gray-dark">{item.desc}</span>
            </span>
            <span className="font-body text-gray-mid" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-gray-mid bg-white px-4 py-2">
        <SignOutNavItem variant="sidebar" />
      </div>
    </div>
  );
}
