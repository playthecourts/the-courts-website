"use client";

import { useEffect, useState } from "react";

// Connectivity is unreliable in gyms, and the one thing we must never do is
// let a coach believe attendance saved when it didn't. This banner makes the
// offline state unmissable; the attendance UI additionally marks individual
// rows as unsynced and retries (see attendance-controls.tsx).
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <p
      role="status"
      className="bg-amber-300 px-4 py-2 text-center font-sport text-[11px] font-bold uppercase tracking-wide text-amber-950"
    >
      No connection — changes will save when you&apos;re back online
    </p>
  );
}
