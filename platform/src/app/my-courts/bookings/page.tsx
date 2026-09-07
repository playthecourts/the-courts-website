import { redirect } from "next/navigation";

// Superseded by /my-courts/explore (same booking logic, Courts-branded,
// with sport/type filters). Kept as a redirect so any existing links
// or bookmarks still land somewhere real.
export default function BookingsPageRedirect() {
  redirect("/my-courts/explore");
}
