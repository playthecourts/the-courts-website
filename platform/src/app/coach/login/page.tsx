import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCoachOrNull } from "@/lib/coach-dal";
import { CoachLoginForm } from "./coach-login-form";

// The Coach App's own front door. Separate from /login (the parent-facing one)
// so a coach opening coach.playthecourts.com never lands in the family portal
// — but it uses the same Supabase Auth and the same login action underneath.
// Coach accounts are now self-serve (see /coach/signup) — the role is always
// hardcoded to "coach" server-side, so a signup here can never grant admin
// access, but anyone with the link can create one.
export default async function CoachLoginPage() {
  // Already signed in as staff — skip the form.
  const actor = await getCoachOrNull();
  if (actor) redirect("/coach");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-warm-white px-6">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={186}
        height={80}
        className="mb-6 h-14 w-auto"
        priority
      />
      <p className="mb-1 font-sport text-xs font-bold uppercase tracking-[0.18em] text-orange">
        Coach
      </p>
      <h1 className="mb-1.5 font-display text-3xl font-black uppercase leading-none tracking-tight text-near-black">
        Ready to Run It?
      </h1>
      <p className="mb-7 font-body text-sm text-gray-dark">
        Sign in to see today&apos;s court.
      </p>

      <Suspense fallback={null}>
        <CoachLoginForm />
      </Suspense>

      <p className="mt-8 font-body text-xs leading-relaxed text-gray-dark">
        New coach?{" "}
        <a href="/coach/signup" className="font-bold text-orange underline underline-offset-2">
          Create an account
        </a>
        . Don&apos;t create a parent account — that&apos;s a different login.
      </p>
    </main>
  );
}
