import { signWaiver } from "@/app/my-courts/waivers/actions";

export function SignForm({
  waiverId,
  athleteId,
  label,
}: {
  waiverId: string;
  athleteId: string | null;
  label: string;
}) {
  const action = signWaiver.bind(null, waiverId, athleteId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
        {label} — type your full legal name to sign
        <input
          name="typedName"
          required
          minLength={2}
          placeholder="Full name"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>
      <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white">
        I agree and sign
      </button>
    </form>
  );
}
