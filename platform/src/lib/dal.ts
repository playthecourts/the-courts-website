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

  if (guardian) return guardian;

  // Authenticated, but no guardian is linked to this login yet.
  //
  // This is the legacy families' other locked door. Their Guardian rows came
  // across from NextGen with authId null. signUp already claims such a record
  // by email (see actions/auth.ts) — but someone who resets their password
  // instead of signing up never goes through that path, authenticates fine,
  // and is then told to "contact us". Same claim, same trust model, applied on
  // the way in: an unlinked record whose email matches the verified address on
  // this login is theirs.
  //
  // Deliberately narrow: only an authId of null is ever claimed, so a record
  // already attached to another login can never be taken over.
  const email = user.email?.trim().toLowerCase();
  if (email) {
    const unlinked = await prisma.guardian.findFirst({
      where: { authId: null, email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    if (unlinked) {
      await prisma.guardian.update({
        where: { id: unlinked.id },
        data: { authId: user.id },
      });

      const claimed = await prisma.guardian.findUnique({
        where: { authId: user.id },
        include: {
          families: {
            include: {
              family: { include: { athletes: { where: { archivedAt: null } } } },
            },
          },
        },
      });
      if (claimed) return claimed;
    }
  }

  // Genuinely nothing on file for this address.
  redirect("/login?error=no-profile");
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
