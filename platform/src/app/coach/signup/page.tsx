import Image from "next/image";
import { redirect } from "next/navigation";
import { getCoachOrNull } from "@/lib/coach-dal";
import { CoachSignupForm } from "./coach-signup-form";

// Self-serve coach signup — every new account is hardcoded to the "coach"
// role server-side (see coachSignup() in app/actions/auth.ts); there is no
// way to self-select a higher role from this form.
export default async function CoachSignupPage() {
  const actor = await getCoachOrNull();
  if (actor) redirect("/coach");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-warm-white px-6 py-10">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={186}
        height={80}
        className="mb-6 h-14 w-auto"
        priority
      />
      <p className="mb-1 font-sport text-xs font-bold uppercase tracking-[0.18em] text-orange">Coach</p>
      <h1 className="mb-1.5 font-display text-3xl font-black uppercase leading-none tracking-tight text-near-black">
        Join the Staff
      </h1>
      <p className="mb-7 font-body text-sm text-gray-dark">Create your coach account for The Courts.</p>

      <CoachSignupForm />

      <p className="mt-8 font-body text-xs leading-relaxed text-gray-dark">
        Already have an account?{" "}
        <a href="/coach/login" className="font-bold text-orange underline underline-offset-2">
          Sign in
        </a>
      </p>
    </main>
  );
}
