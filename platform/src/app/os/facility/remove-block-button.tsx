"use client";

import { useTransition } from "react";
import { removeFacilityBlock } from "./actions";

export function RemoveBlockButton({ blockId }: { blockId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Remove this closure? The courts become bookable again.")) {
          start(async () => { await removeFacilityBlock(blockId); });
        }
      }}
      className="os-eyebrow min-h-9 px-2 text-danger underline underline-offset-2"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
