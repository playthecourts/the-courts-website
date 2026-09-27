import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

// Every /login?error=... code any part of the app actually redirects with —
// a silent bounce back to a plain sign-in screen reads as "the app is
// broken" (this is exactly what a stale/already-used password reset link
// looked like before this existed: no explanation, just back at login).
const ERROR_MESSAGES: Record<string, string> = {
  link_expired:
    "That link has expired or was already used. Request a new password reset link below.",
  "not-staff": "That account isn't set up for staff access.",
  inactive: "That staff account is inactive. Contact an admin.",
  "no-profile": "We couldn't find a family profile for that account. Contact us and we'll fix it.",
  "no-os-access": "That account doesn't have access to Courts OS.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Something went wrong signing you in. Please try again.") : null;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={186}
        height={80}
        className="mb-6"
        priority
      />
      <h1 className="mb-1 font-display text-2xl font-black uppercase tracking-tight text-black">
        Sign In
      </h1>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Manage your family&apos;s classes, bookings, and membership.
      </p>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-orange bg-orange/5 p-3 font-body text-sm text-near-black">
          {errorMessage}
        </div>
      ) : null}

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center font-body text-sm text-gray-dark">
        New here?{" "}
        <Link href={signupHref} className="font-semibold text-orange hover:text-orange-hover">
          Create an account
        </Link>
      </p>
    </main>
  );
}
