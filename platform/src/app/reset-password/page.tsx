import Image from "next/image";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
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
        Set a New Password
      </h1>
      <p className="mb-6 font-body text-sm text-gray-dark">
        Choose a new password for your account.
      </p>

      <ResetPasswordForm />
    </main>
  );
}
