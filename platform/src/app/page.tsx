import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">The Courts — Member Platform</h1>
      <p className="max-w-sm text-sm text-neutral-600">
        Family accounts, bookings, and membership management. This app is
        under active development.
      </p>
      <Link href="/login" className="text-sm font-semibold underline">
        Sign in →
      </Link>
    </main>
  );
}
