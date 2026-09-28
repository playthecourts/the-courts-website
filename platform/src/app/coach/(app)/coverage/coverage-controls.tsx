"use client";

import { useTransition } from "react";
import { cancelCoverageRequest, assignCoverage } from "./actions";

export function CancelCoverageButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Withdraw this coverage request?")) {
          startTransition(() => cancelCoverageRequest(requestId));
        }
      }}
      className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark underline decoration-gray-mid underline-offset-2 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}

export function AssignCoverageForm({
  requestId,
  candidates,
}: {
  requestId: string;
  candidates: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => {
        const staffUserId = String(formData.get("staffUserId") ?? "");
        if (!staffUserId) return;
        startTransition(() => assignCoverage(requestId, staffUserId));
      }}
      className="flex items-center gap-2"
    >
      <select
        name="staffUserId"
        required
        disabled={isPending}
        defaultValue=""
        className="min-h-9 flex-1 rounded-lg border border-gray-mid bg-white px-2 text-sm"
      >
        <option value="" disabled>
          Assign a coach…
        </option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="min-h-9 shrink-0 rounded-lg bg-orange px-4 font-heading text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-hover disabled:opacity-50"
      >
        {isPending ? "Assigning…" : "Assign"}
      </button>
    </form>
  );
}
