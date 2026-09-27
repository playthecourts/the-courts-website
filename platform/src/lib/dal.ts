import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Data Access Layer: the real (DB-backed) auth check for protected pages.
// proxy.ts only does an optimistic cookie check — this is the actual gate.
export async function getCurrentGuardian() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const guardian = await prisma.guardian.findUnique({
    where: { authId: user.id },
    include: {
      families: {
        include: {
          // Archived athletes (see Athlete.archivedAt) stay in the database
          // for real — bookings, waivers, membership history — but this is
          // the single query every parent page derives its athlete list
          // from, so excluding them here is enough to remove them from the
          // roster everywhere at once.
          family: { include: { athletes: { where: { archivedAt: null } } } },
        },
      },
    },
  });

  if (!guardian) {
    // Authenticated with Supabase but no guardian profile provisioned yet.
    // No self-serve signup flow exists yet — this is an admin-provisioning gap for later.
    redirect("/login?error=no-profile");
  }

  return guardian;
}

/// Whether this same login (same Supabase auth id) also has an active
/// StaffUser record — a Courts parent who's also staff. Drives the "Switch
/// to Admin" link in the family sidebar; a separate lookup rather than a
/// field on getCurrentGuardian's return so every existing caller's shape
/// stays untouched.
export async function hasActiveStaffAccount(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const staff = await prisma.staffUser.findUnique({
    where: { authId: user.id },
    select: { active: true },
  });
  return staff?.active === true;
}
