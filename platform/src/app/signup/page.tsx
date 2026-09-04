import Image from "next/image";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={200}
        height={56}
        className="mb-8 h-10 w-auto"
        priority
      />
      <h1 className="mb-1 font-display text-2xl font-black uppercase tracking-tight text-black">
        Create Your Account
      </h1>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Set up your family so you can book classes, sign waivers, and manage membership.
      </p>

      <SignupForm />

      <p className="mt-6 text-center font-body text-sm text-gray-dark">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-orange hover:text-orange-hover">
          Sign in
        </Link>
      </p>
    </main>
  );
}
