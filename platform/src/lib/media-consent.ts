// Photo + video permission: the release text, its version, and the labels the
// four apps use to talk about it.
//
// ---------------------------------------------------------------------------
// ⚠️  THE RELEASE TEXT BELOW IS A DRAFT AND HAS NOT BEEN REVIEWED BY COUNSEL.
//
// The Courts has no approved media-release document today (checked: the
// participant waiver at ../../participant-waiver.html contains no photo/video
// release, and INTERNAL-LEGAL-REVIEW.md lists minor consent and participation
// documents as still needing Tennessee counsel review). This text was drafted
// to make the flow real and to be specific about what a parent is agreeing to.
// It is NOT attorney-approved and must not be presented as though it were.
//
// Replace RELEASE_BODY with the approved wording and bump RELEASE_VERSION when
// it lands. Every stored consent records the version that was on screen, so
// swapping the text never silently re-characterises what a parent already
// agreed to — and the UI renders REVIEW_PENDING as a visible notice while this
// remains a draft.
// ---------------------------------------------------------------------------

import type { MediaConsentStatus } from "@/generated/prisma/enums";

export const RELEASE_VERSION = "2026-09-draft-1";
export const REVIEW_PENDING = true;

/// Deliberately enumerated rather than "for marketing purposes". A parent
/// cannot agree to something they have to guess the boundaries of.
export const RELEASE_CHANNELS = [
  "The Courts website",
  "The Courts social media accounts, including Instagram and Facebook",
  "Email marketing sent by The Courts",
  "Digital advertising run by The Courts",
  "Printed promotional materials",
  "Signage and displays inside the facility",
  "Other promotional materials owned by The Courts",
];

export const RELEASE_BODY = [
  "If you say yes, The Courts may use photos and video that include your athlete in the channels listed above. These are all channels The Courts owns or runs.",
  "This permission does not extend to sponsors, partners, other families, or outside organizations. If The Courts is ever asked to share an image beyond its own channels, we will ask you separately.",
  "Saying yes does not give The Courts permission to publish your athlete's full name, date of birth, school, home location, or any of their health or family information. Our practice is to use no name, or a first name only where it fits.",
  "You can change this choice at any time in the Parent App under your athlete's Privacy + Permissions. New choices apply going forward. If something has already been printed, posted, or distributed, we will do what we reasonably can — but we can't promise that material already in the world disappears everywhere.",
  "Choosing 'No' will never affect your athlete's ability to participate in anything at The Courts.",
];

export const GUARDIAN_ACKNOWLEDGMENT =
  "I am the athlete's parent or legal guardian and agree to the photo/video permissions selected above.";

// ---------------------------------------------------------------------------
// Labels
//
// The parent sees a full sentence, because they are making a decision. Staff
// see two words, because they are scanning a roster before a photographer
// walks in. Same stored value, two vocabularies.
// ---------------------------------------------------------------------------

export const PARENT_CHOICES: {
  status: MediaConsentStatus;
  headline: string;
  detail: string;
}[] = [
  {
    status: "media_ok",
    headline: "Yes — photos + video are okay",
    detail: "We can include them in photos and video on our own channels.",
  },
  {
    status: "media_limited",
    headline: "Limited — ask me first",
    detail: "Check with me before using anything where they're identifiable.",
  },
  {
    status: "media_no",
    headline: "No — please don't use identifiable photos or video",
    detail: "They can still be in group activities; we just won't publish anything identifiable.",
  },
];

export const STAFF_LABELS: Record<MediaConsentStatus, string> = {
  media_ok: "Media OK",
  media_limited: "Ask First",
  media_no: "No Media",
};

/// The label for an athlete whose parent hasn't answered yet. Treated as
/// "ask first" operationally: an unanswered question is not a yes.
export const UNANSWERED_STAFF_LABEL = "Not Answered";

export function staffMediaLabel(status: MediaConsentStatus | null | undefined): string {
  return status ? STAFF_LABELS[status] : UNANSWERED_STAFF_LABEL;
}

/// Whether staff may publish an image of this athlete without checking first.
/// Only an explicit media_ok qualifies — null, limited and no all mean "stop".
export function canPublishWithoutAsking(status: MediaConsentStatus | null | undefined): boolean {
  return status === "media_ok";
}

/// Group photography does not override anyone's preference. This is what the
/// pre-shoot list is built from.
export function needsPhotographerAttention(status: MediaConsentStatus | null | undefined): boolean {
  return status !== "media_ok";
}
