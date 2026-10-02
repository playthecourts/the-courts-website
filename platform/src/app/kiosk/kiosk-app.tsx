"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { kioskCheckIn } from "./actions";

// Lobby self check-in: pick your class → tap your name → "Yes, that's me".
// Every screen falls back to the start on its own, so the next kid never walks
// up to someone else's name still on the glass.

export type KioskClass = {
  id: string;
  name: string;
  time: string;
  athletes: { bookingId: string; name: string; here: boolean }[];
};

type Screen =
  | { kind: "classes" }
  | { kind: "names"; classId: string }
  | { kind: "confirm"; classId: string; bookingId: string; name: string }
  | { kind: "done"; name: string; late: boolean }
  | { kind: "error"; message: string };

const IDLE_MS = 30_000;
const DONE_MS = 4_000;

export function KioskApp({ classes }: { classes: KioskClass[] }) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: "classes" });
  const [pending, start] = useTransition();
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Back to the start after inactivity (or a few seconds after a check-in).
  useEffect(() => {
    if (screen.kind === "classes") return;
    idle.current = setTimeout(() => setScreen({ kind: "classes" }), screen.kind === "done" ? DONE_MS : IDLE_MS);
    return () => {
      if (idle.current) clearTimeout(idle.current);
    };
  }, [screen]);

  // Keep the class list current (new classes open, others end) while idle.
  useEffect(() => {
    if (screen.kind !== "classes") return;
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [screen.kind, router]);

  function confirm(bookingId: string, name: string) {
    start(async () => {
      const res = await kioskCheckIn(bookingId);
      setScreen(res.ok ? { kind: "done", name, late: res.late } : { kind: "error", message: res.error });
      router.refresh();
    });
  }

  const current = screen.kind === "names" || screen.kind === "confirm" ? classes.find((c) => c.id === screen.classId) : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-8 flex items-center justify-between">
        <p className="font-display text-[26px] font-black uppercase tracking-tight">
          The <span className="text-orange">Courts</span>
        </p>
        {screen.kind !== "classes" ? (
          <button
            type="button"
            onClick={() => setScreen({ kind: "classes" })}
            className="min-h-[52px] rounded-full border border-white/30 px-6 font-sport text-[15px] font-bold uppercase tracking-wide hover:bg-white/10"
          >
            ← Start Over
          </button>
        ) : null}
      </header>

      {screen.kind === "classes" ? (
        <>
          <h1 className="font-display text-[44px] font-black uppercase leading-none tracking-tight md:text-[56px]">Check In</h1>
          <p className="mt-3 mb-8 font-body text-[19px] text-white/70">Tap your class.</p>
          {classes.length === 0 ? (
            <p className="rounded-2xl border border-white/15 px-6 py-10 text-center font-body text-[19px] text-white/70">
              No classes are open for check-in right now. Check-in opens an hour before class.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setScreen({ kind: "names", classId: c.id })}
                  className="flex min-h-[120px] flex-col justify-center rounded-2xl bg-white px-6 py-5 text-left text-near-black active:scale-[0.98]"
                >
                  <span className="font-sport text-[16px] font-bold uppercase tracking-[0.12em] text-orange">{c.time}</span>
                  <span className="mt-1 font-heading text-[24px] font-bold leading-tight">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {screen.kind === "names" && current ? (
        <>
          <p className="font-sport text-[16px] font-bold uppercase tracking-[0.12em] text-orange">{current.time} · {current.name}</p>
          <h1 className="mt-1 mb-8 font-display text-[40px] font-black uppercase leading-none tracking-tight">Tap your name</h1>
          {current.athletes.length === 0 ? (
            <p className="font-body text-[19px] text-white/70">Nobody is signed up for this class yet — please see the front desk.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {current.athletes.map((a) =>
                a.here ? (
                  <div key={a.bookingId} className="flex min-h-[88px] items-center justify-center gap-2 rounded-2xl bg-emerald-700/40 px-4 text-center font-heading text-[21px] font-bold text-white/80">
                    <span aria-hidden="true">✓</span> {a.name}
                  </div>
                ) : (
                  <button
                    key={a.bookingId}
                    type="button"
                    onClick={() => setScreen({ kind: "confirm", classId: current.id, bookingId: a.bookingId, name: a.name })}
                    className="min-h-[88px] rounded-2xl bg-white px-4 font-heading text-[21px] font-bold text-near-black active:scale-[0.98]"
                  >
                    {a.name}
                  </button>
                )
              )}
            </div>
          )}
          <p className="mt-8 font-body text-[17px] text-white/60">Don&apos;t see your name? Please check in at the front desk.</p>
        </>
      ) : null}

      {screen.kind === "confirm" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-body text-[22px] text-white/70">Are you</p>
          <p className="mt-2 font-display text-[56px] font-black uppercase leading-none tracking-tight md:text-[72px]">{screen.name}?</p>
          <div className="mt-10 flex w-full max-w-xl flex-col gap-4 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm(screen.bookingId, screen.name)}
              className="min-h-[88px] flex-1 rounded-2xl bg-orange font-display text-[26px] font-black uppercase tracking-tight text-white disabled:opacity-60"
            >
              {pending ? "Checking in…" : "Yes, that's me"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setScreen({ kind: "names", classId: screen.classId })}
              className="min-h-[88px] flex-1 rounded-2xl border-2 border-white/40 font-display text-[22px] font-black uppercase tracking-tight"
            >
              No, go back
            </button>
          </div>
        </div>
      ) : null}

      {screen.kind === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span aria-hidden="true" className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-[64px] font-black">✓</span>
          <p className="mt-6 font-display text-[52px] font-black uppercase leading-none tracking-tight">You&apos;re in, {screen.name.split(" ")[0]}!</p>
          <p className="mt-4 font-body text-[21px] text-white/70">{screen.late ? "Class has started — head straight to your court." : "Grab your gear. Let's go."}</p>
        </div>
      ) : null}

      {screen.kind === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-[40px] font-black uppercase leading-tight tracking-tight">Let&apos;s get you some help</p>
          <p className="mt-4 max-w-xl font-body text-[20px] text-white/70">{screen.message}</p>
          <button
            type="button"
            onClick={() => setScreen({ kind: "classes" })}
            className="mt-8 min-h-[72px] rounded-2xl bg-white px-10 font-display text-[22px] font-black uppercase text-near-black"
          >
            OK
          </button>
        </div>
      ) : null}

      <footer className="mt-auto flex justify-end pt-10">
        <Link href="/kiosk/exit" className="px-3 py-2 font-sport text-[12px] font-bold uppercase tracking-wide text-white/25">
          Staff
        </Link>
      </footer>
    </div>
  );
}
