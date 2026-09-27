import { redirect } from "next/navigation";

// Superseded by /my-courts/explore filtered to Camps — Events only ever
// showed the same one-day-break sessions (Early Release, Day Off/Game On)
// that Explore's own "camps" category already surfaces, just without the
// rest of Explore's filters. Kept as a redirect so any existing links or
// bookmarks still land somewhere real.
export default function EventsPageRedirect() {
  redirect("/my-courts/explore?cat=camps");
}
