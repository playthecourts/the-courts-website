import { getCurrentGuardian } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

export default async function SettingsPage() {
  const guardian = await getCurrentGuardian();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">Settings</h1>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Account
        </p>
        <div className="rounded-2xl border border-gray-mid bg-white px-4 py-3.5">
          <p className="font-heading text-sm font-bold text-near-black">{guardian.name}</p>
          <p className="mt-0.5 font-body text-sm text-gray-dark">{guardian.email}</p>
        </div>
      </section>

      <p className="font-body text-[12.5px] text-gray-dark">
        More settings — notification preferences, phone number, and password — are coming soon.
      </p>

      <form action={logout}>
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg border border-gray-mid bg-white font-sport text-xs font-bold uppercase tracking-wide text-gray-dark"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
