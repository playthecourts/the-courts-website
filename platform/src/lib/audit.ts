import "server-only";
import { prisma } from "@/lib/prisma";

// Append-only trail for staff actions that touch sensitive athlete data or
// change who can do what. Deliberately fire-and-forget-safe: an audit write
// failing must never break the coach's actual task courtside, but it is
// awaited (not floated) so it lands before the action returns.

export type AuditAction =
  | "view_emergency_info"
  | "view_medical_notes"
  | "share_note_with_parent"
  | "unshare_note"
  | "record_attendance"
  | "assign_team_member"
  | "remove_team_member"
  | "assign_coverage"
  | "file_incident"
  | "send_communication"
  | "publish_announcement"
  | "change_capacity"
  | "offer_waitlist_spot"
  // --- Program Builder + Scheduler ---
  | "create_sessions"
  | "move_session"
  | "cancel_session"
  | "publish_offering"
  | "unpublish_offering"
  | "archive_offering"
  | "clone_offering"
  | "change_price"
  | "link_stripe"
  | "override_conflict"
  | "block_facility"
  | "promote_waitlist"
  | "decline_waitlist";

export async function auditLog(
  staffUserId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        staffUserId,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (err) {
    // Never surface an audit failure to a coach mid-session.
    console.error("[audit] failed to write audit log", { action, entityType, entityId }, err);
  }
}
