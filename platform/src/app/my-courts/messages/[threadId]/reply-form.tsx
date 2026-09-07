"use client";

import { useActionState, useRef, useEffect } from "react";
import { replyToThread } from "../actions";

export function ReplyForm({ threadId }: { threadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, fd: FormData) => {
      const r = await replyToThread(threadId, fd);
      return r ?? null;
    },
    null
  );

  // Clear the box once the reply has landed, so a slow connection can't leave
  // the parent unsure whether they sent it twice.
  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <label htmlFor="body" className="sr-only">Your reply</label>
      <textarea
        id="body"
        name="body"
        rows={3}
        required
        placeholder="Write a reply…"
        className="w-full rounded-lg border border-gray-mid bg-white px-3 py-2 font-body text-sm focus:border-orange focus:outline-none"
      />
      {state?.error ? (
        <p role="alert" className="font-body text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-end rounded-md bg-orange px-5 font-sport text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
