import "server-only";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Athlete profile photos.
//
// Provider: Supabase Storage, private bucket `athlete-photos`. Supabase was
// already the auth provider and database, so no second storage vendor and no
// second access-control model was introduced. Bucket + policies are created by
// scripts/setup-storage.ts.
//
// Three rules this module exists to enforce:
//
//   1. The database holds a PATH, never image bytes and never a URL.
//   2. There is no public URL for a child's photo. Every render goes through a
//      short-lived signed URL minted for the person asking.
//   3. Storage authorization is not this module's promise. The bucket's RLS
//      policies re-derive the athlete id from the object path and check the
//      caller against family_guardians / staff_users, so a hand-crafted request
//      with someone else's path fails in Postgres, not in a React component.
//
// Images are resized and compressed in the BROWSER before they get here (see
// photo-picker.tsx) — a square ~640px JPEG. That keeps a 12MP phone photo from
// ever crossing the wire, needs no native image dependency on the server, and
// is also where crop/reposition happens. The server still re-checks type and
// size, because a client-side constraint is a convenience, not a control.
// ---------------------------------------------------------------------------

export const PHOTO_BUCKET = "athlete-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/// Signed URLs are deliberately short-lived. A page render is seconds; an hour
/// would be a link worth passing around.
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export function photoObjectPath(athleteId: string, ext: string): string {
  // athletes/<athleteId>/<timestamp>.<ext> — the athlete id has to be the
  // second segment because the storage policies parse it out of this path.
  return `athletes/${athleteId}/${Date.now()}.${ext}`;
}

export function extensionForType(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/**
 * A viewable URL for one photo, or null. Returns null rather than throwing:
 * a missing or unauthorized photo should degrade to the initials avatar, never
 * take down the page that was showing it.
 */
export async function signedPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Batch version — one round trip for a roster instead of one per athlete.
 * Keyed by path so callers can look up per athlete.
 */
export async function signedPhotoUrls(
  paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return out;

  for (const row of data) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Uploads on behalf of the SIGNED-IN user — the request carries their session,
 * so the bucket policy is what ultimately allows or denies the write. This
 * function never elevates to a service-role key; if it did, a bug here would
 * become a way to write into any family's folder.
 */
export async function uploadAthletePhoto(
  athleteId: string,
  file: File
): Promise<UploadResult> {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { ok: false, error: "That file type isn't supported. Use a JPG, PNG or WEBP." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "That image is too large. Please pick one under 5MB." };
  }
  const ext = extensionForType(file.type);
  if (!ext) return { ok: false, error: "That file type isn't supported." };

  const path = photoObjectPath(athleteId, ext);
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

  if (error) {
    return { ok: false, error: "We couldn't save that photo. Please try again." };
  }
  return { ok: true, path };
}

/**
 * Best-effort removal of the replaced file. A failure here is a stray object,
 * not a broken profile, so it is logged and swallowed — the new path is already
 * on the athlete record by the time this runs.
 */
export async function deleteAthletePhoto(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    const supabase = await createClient();
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  } catch (err) {
    console.error("[athlete-photo] failed to remove old photo", path, err);
  }
}
