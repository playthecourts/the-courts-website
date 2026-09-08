import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Image
        src="/brand/logo-horizontal-full-color.png"
        alt="The Courts"
        width={220}
        height={94}
        className="mb-8"
        priority
      />
      <h1 className="max-w-[14ch] font-display text-[34px] leading-[1.05] font-black tracking-tight text-near-black md:text-[44px]">
        We&rsquo;re Glad You&rsquo;re Here.
      </h1>
      <p className="mt-3 max-w-sm font-body text-[15px] text-gray-dark">
        Family accounts, bookings, and membership management — all in one place.
      </p>

      <Link
        href="/login"
        className="mt-8 inline-flex min-h-[48px] items-center rounded-lg bg-orange px-7 font-sport text-[13.5px] font-bold tracking-wide text-white uppercase hover:bg-orange-hover"
      >
        Sign In &rarr;
      </Link>
      <p className="mt-4 font-body text-sm text-gray-dark">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-orange hover:text-orange-hover">
          Create an account
        </Link>
      </p>
    </main>
  );
}
