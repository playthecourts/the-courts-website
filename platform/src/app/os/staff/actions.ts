"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

// Staff roster actions. Both are owner-only (staff.manage): merging and
// deactivating change who can see which athletes in the Coach App.

/// Folds a duplicate staff profile into the one being kept.
///
/// Duplicates happen when a coach signs up through /coach/signup after a
/// profile was already made for them — the two rows aren't linked, so their
/// classes sit on one profile while they log in as the other. Merging moves
/// everything that decides what a coach SEES (session + team assignments,
/// availability, coverage requests) onto the keeper, then deactivates the
/// duplicate rather than deleting it, so historical notes and attendance that
/// still point at it stay intact.
export async function mergeStaff(formData: FormData) {
  const actor = await requireCapability("staff.manage");
  const keepId = String(formData.get("keepId") ?? "");
  const dropId = String(formData.get("dropId") ?? "");

  if (!keepId || !dropId || keepId === dropId) {
    redirect("/os/staff?error=" + encodeURIComponent("Pick two different profiles to merge."));
  }
  if (dropId === actor.id) {
    redirect("/os/staff?error=" + encodeURIComponent("You can't merge away the profile you're signed in as."));
  }

  const [keep, drop] = await Promise.all([
    prisma.staffUser.findUnique({ where: { id: keepId } }),
    prisma.staffUser.findUnique({ where: { id: dropId } }),
  ]);
  if (!keep || !drop) {
    redirect("/os/staff?error=" + encodeURIComponent("One of those profiles no longer exists."));
  }

  const moved = await prisma.$transaction(async (tx) => {
    // Session assignments. Where both profiles are already on the same
    // session, the duplicate's row is simply dropped.
    const keepSessions = new Set(
      (await tx.sessionCoach.findMany({ where: { staffUserId: keepId }, select: { sessionId: true } })).map(
        (r) => r.sessionId
      )
    );
    const dropSessions = await tx.sessionCoach.findMany({ where: { staffUserId: dropId } });
    let sessions = 0;
    for (const r of dropSessions) {
      if (keepSessions.has(r.sessionId)) {
        await tx.sessionCoach.delete({
          where: { sessionId_staffUserId: { sessionId: r.sessionId, staffUserId: dropId } },
        });
      } else {
        await tx.sessionCoach.create({
          data: { sessionId: r.sessionId, staffUserId: keepId, role: r.role, assignedAt: r.assignedAt },
        });
        await tx.sessionCoach.delete({
          where: { sessionId_staffUserId: { sessionId: r.sessionId, staffUserId: dropId } },
        });
        sessions++;
      }
    }

    // Team assignments, same rule.
    const keepTeams = new Set(
      (await tx.teamCoach.findMany({ where: { staffUserId: keepId }, select: { teamId: true } })).map((r) => r.teamId)
    );
    const dropTeams = await tx.teamCoach.findMany({ where: { staffUserId: dropId } });
    let teams = 0;
    for (const r of dropTeams) {
      if (!keepTeams.has(r.teamId)) {
        await tx.teamCoach.create({
          data: { teamId: r.teamId, staffUserId: keepId, role: r.role, assignedAt: r.assignedAt },
        });
        teams++;
      }
      await tx.teamCoach.delete({ where: { teamId_staffUserId: { teamId: r.teamId, staffUserId: dropId } } });
    }

    const availability = await tx.coachAvailability.updateMany({
      where: { staffUserId: dropId },
      data: { staffUserId: keepId },
    });
    await tx.coverageRequest.updateMany({ where: { requestedById: dropId }, data: { requestedById: keepId } });
    await tx.coverageRequest.updateMany({ where: { assignedToId: dropId }, data: { assignedToId: keepId } });

    // Keep the fuller name ("Johnny" → "Johnny Coles") and fill in any
    // contact details the keeper is missing.
    const fullerName = drop.name.trim().length > keep.name.trim().length ? drop.name.trim() : keep.name;
    const sports = [...new Set([...keep.sports, ...drop.sports])];
    await tx.staffUser.update({
      where: { id: keepId },
      data: {
        name: fullerName,
        phone: keep.phone ?? drop.phone,
        title: keep.title ?? drop.title,
        // Sports on a plain coach are descriptive only; on a head coach they
        // scope access, so never widen a head coach's scope by merging.
        sports: keep.role === "head_coach" ? keep.sports : sports,
      },
    });
    await tx.staffUser.update({ where: { id: dropId }, data: { active: false } });

    return { sessions, teams, availability: availability.count };
  });

  await auditLog(actor.id, "merge_staff", "staff_user", keepId, {
    mergedFrom: dropId,
    mergedFromName: drop.name,
    mergedFromEmail: drop.email,
    ...moved,
  });

  revalidatePath("/os/staff");
  redirect(
    "/os/staff?merged=" +
      encodeURIComponent(
        `Merged ${drop.name} into ${keep.name}: ${moved.sessions} session${moved.sessions === 1 ? "" : "s"} moved. The old profile is now inactive.`
      )
  );
}

export async function setStaffActive(formData: FormData) {
  const actor = await requireCapability("staff.manage");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  if (id === actor.id && !active) {
    redirect("/os/staff?error=" + encodeURIComponent("You can't deactivate your own profile."));
  }
  await prisma.staffUser.update({ where: { id }, data: { active } });
  await auditLog(actor.id, "set_staff_active", "staff_user", id, { active });
  revalidatePath("/os/staff");
}
