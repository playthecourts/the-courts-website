import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthToggle } from "../auth-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
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
      <AuthToggle active="signin" />
      <h1 className="mb-1 font-display text-2xl font-black uppercase tracking-tight text-black">
        Sign In
      </h1>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Manage your family&apos;s classes, bookings, and membership.
      </p>

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
