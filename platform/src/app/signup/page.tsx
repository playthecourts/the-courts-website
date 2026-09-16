import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={186}
        height={80}
        className="mb-6"
        priority
      />
      <h1 className="mb-1 font-display text-2xl font-black uppercase tracking-tight text-black">
        Create Your Courts Account
      </h1>
      <p className="mb-1 font-heading text-sm font-bold text-orange">Your home court starts here.</p>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Set up your family to book classes, manage memberships, sign waivers, and get on the court.
      </p>

      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>

      <p className="mt-6 text-center font-body text-sm text-gray-dark">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-orange hover:text-orange-hover">
          Sign in
        </Link>
      </p>
    </main>
  );
}
