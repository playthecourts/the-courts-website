import Link from "next/link";

export default function OsNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="os-eyebrow text-orange">Not Found</p>
      <h1 className="os-display mt-3 text-2xl text-near-black">Nothing at that address.</h1>
      <p className="mt-3 text-sm text-gray-dark">
        The record may have been archived or deleted, or the link may be out of date.
      </p>
      <Link
        href="/os"
        className="os-heading mt-6 inline-flex min-h-11 items-center rounded-lg bg-orange px-4 text-sm uppercase tracking-wide text-white hover:bg-orange-hover"
      >
        Back to Today
      </Link>
    </div>
  );
}
