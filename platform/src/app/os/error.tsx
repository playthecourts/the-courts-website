"use client";

import Link from "next/link";

// Courts OS error boundary. An access denial and a genuine fault look
// different here on purpose: one is "you can't", the other is "we broke".
// Neither ever says "Something went wrong."
export default function OsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAccess = error.name === "OsAccessError" || error.message.includes("access");

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="os-eyebrow text-orange">{isAccess ? "Not Permitted" : "Something Broke"}</p>
      <h1 className="os-display mt-3 text-2xl text-near-black">
        {isAccess ? "That's not yours to open." : "Courts OS hit an error."}
      </h1>
      <p className="mt-3 text-sm text-gray-dark">
        {isAccess
          ? error.message
          : "The page couldn't load. This has been logged. Try again, and if it keeps happening, note what you were doing when it broke."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {!isAccess ? (
          <button
            type="button"
            onClick={reset}
            className="os-heading min-h-11 rounded-lg bg-orange px-4 text-sm uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            Try again
          </button>
        ) : null}
        <Link
          href="/os"
          className="os-heading min-h-11 rounded-lg border border-gray-mid bg-white px-4 text-sm uppercase leading-[2.75rem] tracking-wide text-near-black hover:border-near-black"
        >
          Back to Today
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-neutral">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
