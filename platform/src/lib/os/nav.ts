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
    label: "Athletes + Families",
    href: "/os/families",
    capability: "families.view",
    mobilePriority: true,
  },
  { label: "Leagues + Teams", href: "/os/leagues", capability: "leagues.view" },
  { label: "Coaches", href: "/os/coaches", capability: "coaches.view" },
  { label: "Facility", href: "/os/facility", capability: "facility.view" },
  {
    label: "Communications",
    href: "/os/communications",
    capability: "communications.view",
  },
  { label: "Payments", href: "/os/payments", capability: "payments.view" },
  { label: "Reports", href: "/os/reports", capability: "reports.view" },
  { label: "Content", href: "/os/content", capability: "content.manage" },
];

export const MORE_NAV: NavItem[] = [
  { label: "Leads", href: "/os/leads", capability: "leads.view" },
  { label: "Training Plans", href: "/os/plans", capability: "plans.view" },
  { label: "Promo Codes + Credits", href: "/os/promos", capability: "payments.promo" },
  { label: "Camps", href: "/os/camps", capability: "programs.view" },
  { label: "Rentals + Parties", href: "/os/rentals", capability: "facility.view" },
  { label: "Waivers + Forms", href: "/os/waivers", capability: "programs.view" },
  { label: "Tasks", href: "/os/tasks", capability: "tasks.view" },
  { label: "Staff + Roles", href: "/os/staff", capability: "staff.manage" },
  { label: "Audit Log", href: "/os/audit", capability: "audit.view" },
];

export type QuickAction = { label: string; href: string; capability: Capability };

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create Program", href: "/os/programs/new", capability: "programs.create" },
  { label: "Add Session", href: "/os/schedule/new", capability: "schedule.edit" },
  { label: "Register Athlete", href: "/os/registrations/new", capability: "registrations.create" },
  { label: "Add Family", href: "/os/families/new", capability: "families.edit" },
  { label: "Send Update", href: "/os/communications/new", capability: "communications.send" },
  { label: "Block Court", href: "/os/facility/block", capability: "facility.block" },
  { label: "Add Coach", href: "/os/coaches/new", capability: "coaches.manage" },
];
