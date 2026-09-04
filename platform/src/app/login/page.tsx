import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Manage your family&apos;s classes, bookings, and membership.
      </p>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-neutral-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
