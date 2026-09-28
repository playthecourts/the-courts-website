"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/// The shared logout() in app/actions/auth.ts redirects to /login (the
/// parent-app login) — wrong destination for a coach. Same sign-out
/// mechanics, coach-correct redirect.
export async function coachLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/coach/login");
}
