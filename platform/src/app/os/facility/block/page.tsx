import { redirect } from "next/navigation";

// The blocking form lives on the Facility page, beside the list of what's
// already blocked — which is the context you need to make the decision. This
// route exists only because the quick action points here.
export default function BlockRedirect() {
  redirect("/os/facility#block");
}
