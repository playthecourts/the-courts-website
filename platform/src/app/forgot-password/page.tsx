import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
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
        Reset Your Password
      </h1>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Enter the email on your account and we&apos;ll send you a link to set a new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-center font-body text-sm text-gray-dark">
        <Link href="/login" className="font-semibold text-orange hover:text-orange-hover">
          Back to Sign In
        </Link>
      </p>
    </main>
  );
}
