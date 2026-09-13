import Link from "next/link";

// Shared by /login and /signup so a parent who lands on the wrong one isn't
// stuck scrolling to the bottom of a form to find the way out.
export function AuthToggle({ active }: { active: "signin" | "signup" }) {
  return (
    <div className="mb-6 flex items-center gap-2 font-sport text-[11px] font-bold uppercase tracking-wide">
      <Link
        href="/signup"
        className={
          active === "signup" ? "text-orange" : "text-gray-dark transition-colors hover:text-orange"
        }
      >
        Create Account
      </Link>
      <span className="text-gray-mid">|</span>
      <Link
        href="/login"
        className={
          active === "signin" ? "text-orange" : "text-gray-dark transition-colors hover:text-orange"
        }
      >
        Sign In
      </Link>
    </div>
  );
}
