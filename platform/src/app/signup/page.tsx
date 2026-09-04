import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-2xl font-bold">Create Your Account</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Set up your family so you can book classes, sign waivers, and manage membership.
      </p>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
