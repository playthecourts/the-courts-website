import { redirect } from "next/navigation";

// This page's only job used to be offering "Sign In" or "Create an
// account" — both of which /login and /signup already offer each other,
// making it a redundant extra click for every visitor. Nothing in the app
// links here, so a straight redirect costs nothing.
export default function Home() {
  redirect("/login");
}
