"use client";

import { useEffect } from "react";

// Registers the Coach App service worker (public/coach-sw.js), scoped to
// /coach so it never touches the Parent App at /my-courts. Registration is
// best-effort: if the browser doesn't support it, the app still works, just
// without the cached-shell benefit in a dead-signal gym.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/coach-sw.js", { scope: "/coach/" }).catch((err) => {
      console.warn("[coach] service worker registration failed", err);
    });
  }, []);

  return null;
}
