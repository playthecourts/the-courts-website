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
          family: { include: { athletes: true } },
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
