import type { Capability } from "./permissions";

// Primary navigation. Each entry names the capability that gates it, so the
// sidebar is generated from the same policy that guards the pages — a link
// can't drift out of sync with what the role may actually open.

export type NavItem = {
  label: string;
  href: string;
  capability: Capability;
  /// Shown in the mobile quick bar. The spec explicitly rules out cramming
  /// the whole admin system into bottom nav, so only true on-floor actions.
  mobilePriority?: boolean;
};

export const PRIMARY_NAV: NavItem[] = [
  { label: "Today", href: "/os", capability: "os.access", mobilePriority: true },
  { label: "Schedule", href: "/os/schedule", capability: "schedule.view", mobilePriority: true },
  { label: "Programs", href: "/os/programs", capability: "programs.view" },
  {
    label: "Registrations",
    href: "/os/registrations",
    capability: "registrations.view",
    mobilePriority: true,
  },
  {
    label: "Class Rosters",
    href: "/os/rosters",
    capability: "registrations.view",
    mobilePriority: true,
  },
  {
    label: "Athletes + Families",
    href: "/os/families",
    capability: "families.view",
    mobilePriority: true,
  },
  { label: "Members", href: "/os/members", capability: "families.view" },
  { label: "Leagues + Teams", href: "/os/leagues", capability: "leagues.view" },
  { label: "Progress Reports", href: "/os/progress", capability: "athletes.view" },
  { label: "Photos + Video", href: "/os/media", capability: "athletes.viewMediaStatus" },
  { label: "Facility", href: "/os/facility", capability: "facility.view" },
  // Communications nav entry hidden for now — /os/communications and its
  // capability gate are untouched, just not linked from the sidebar.
  { label: "Payments", href: "/os/payments", capability: "payments.view" },
  // Not built yet, so not linked (every link here must open a real page):
  // Coaches (/os/coaches), Reports (/os/reports),
  // Content (/os/content). Add each back when its page ships.
];

export const MORE_NAV: NavItem[] = [
  { label: "Leads", href: "/os/leads", capability: "leads.view" },
  { label: "NextGen Transfers", href: "/os/nextgen", capability: "nextgen.verify" },
  { label: "Tasks", href: "/os/tasks", capability: "tasks.view" },
  // Not built yet, so not linked: Membership Plans (/os/plans), Promo Codes
  // (/os/promos), Camps (/os/camps), Rentals + Parties (/os/rentals),
  // Waivers + Forms (/os/waivers), Staff + Roles (/os/staff), Audit Log
  // (/os/audit).
];

export type QuickAction = { label: string; href: string; capability: Capability };

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create Program", href: "/os/programs/new", capability: "programs.create" },
  { label: "Add Session", href: "/os/schedule/new", capability: "schedule.edit" },
  { label: "Register Athlete", href: "/os/rosters", capability: "registrations.create" },
  // "Send Update" quick action hidden alongside the Communications nav entry.
  { label: "Block Court", href: "/os/facility/block", capability: "facility.block" },
  // Add Family (/os/families/new) and Add Coach (/os/coaches/new) return
  // when those pages exist.
];
