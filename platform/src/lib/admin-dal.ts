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

  return staff;
}
