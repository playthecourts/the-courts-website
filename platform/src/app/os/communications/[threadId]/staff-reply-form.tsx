"use client";

import { useActionState, useEffect, useRef } from "react";
import { replyAsStaff, reopenThread } from "../actions";
import { Card, BTN, TEXTAREA, ErrorNote } from "../../_components/ui";

export function StaffReplyForm({ threadId, resolved }: { threadId: string; resolved: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (_prev: { ok?: true; error?: string } | null, fd: FormData) => replyAsStaff(threadId, fd),
    null
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="p-4">
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <label htmlFor="body" className="os-eyebrow text-gray-dark">
          Reply to this family
        </label>
        <textarea id="body" name="body" rows={4} required className={TEXTAREA} />

        <p className="text-xs text-neutral">
          This appears in their Parent App. Nothing is emailed or texted — no message transport is
          connected yet, so if it&apos;s urgent, call them.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-dark">
            <input type="checkbox" name="resolve" defaultChecked={!resolved} />
            Mark answered
          </label>
          <div className="flex gap-2">
            {resolved ? (
              <button
                type="button"
                onClick={() => reopenThread(threadId)}
                className={BTN.secondary}
              >
                Reopen
              </button>
            ) : null}
            <button type="submit" disabled={pending} className={BTN.primary}>
              {pending ? "Sending…" : "Send Reply"}
            </button>
          </div>
        </div>

        {state?.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      </form>
    </Card>
  );
}
