import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The one front door: the iPhone/Android app opens here, and it sends each
// person to their own side. Signed out → sign in, then come back here.
//   Owner / admin → Courts OS · Coach → Coach App · Front desk → Front Desk
//   Parent → My Courts
export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/start");

  const [staff, guardian] = await Promise.all([
    prisma.staffUser.findUnique({ where: { authId: user.id }, select: { role: true, active: true } }),
    prisma.guardian.findUnique({ where: { authId: user.id }, select: { id: true } }),
  ]);

  if (staff?.active) {
    if (staff.role === "front_desk") redirect("/checkin");
    if (staff.role === "coach" || staff.role === "head_coach") redirect("/coach");
    redirect("/os");
  }
  if (guardian) redirect("/my-courts");
  redirect("/login?error=no-profile");
}
