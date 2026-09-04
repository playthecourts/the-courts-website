import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={200}
        height={56}
        className="mb-8 h-10 w-auto"
        priority
      />
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
        <Link href="/signup" className="font-semibold text-orange hover:text-orange-hover">
          Create an account
        </Link>
      </p>
    </main>
  );
}
