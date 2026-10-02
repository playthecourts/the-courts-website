import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Real (DB-backed) staff-role check for /admin. proxy.ts only confirms someone
// is logged in — it deliberately does not check staff_users, since that's a
// database lookup and Proxy runs on every request including prefetches.
// This is the actual authorization gate for the admin surface.
export async function getCurrentStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const staff = await prisma.staffUser.findUnique({
    where: { authId: user.id },
  });

  if (!staff) {
    // Authenticated, but not a staff account — a guardian hitting /admin
    // by URL, for instance. Not provisioned as staff, so no access.
    redirect("/login?error=not-staff");
  }

  // The legacy /admin surface predates Courts OS permissions: its pages and
  // actions can create, edit and delete families, sessions, plans and
  // waivers with no per-role checks. So it is owner/admin only. Everyone
  // else is sent to the app their role is built for.
  if (!staff.active) redirect("/login?error=inactive");
  if (staff.role !== "owner" && staff.role !== "admin") {
    redirect(staff.role === "front_desk" ? "/checkin" : staff.role === "coach" || staff.role === "head_coach" ? "/coach" : "/os");
  }

  return staff;
}
