"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Runs only inside The Courts app (iPhone/Android). In a normal browser it
// does nothing. Asks once for notification permission, sends this phone's
// push token to the server, and opens the right screen when a notification
// is tapped.
//
// Gated by NEXT_PUBLIC_NATIVE_PUSH=on: Android crashes if push is requested
// before the Firebase file is in the build, so this stays off until the app
// is built with it.

type Listener = { remove: () => void };
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<Listener>;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { PushNotifications?: PushPlugin };
};

export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!cap?.isNativePlatform?.() || process.env.NEXT_PUBLIC_NATIVE_PUSH !== "on") return;
    const push = cap.Plugins?.PushNotifications;
    if (!push) return;
    const platform = cap.getPlatform?.() === "ios" ? "ios" : "android";
    const listeners: Promise<Listener>[] = [];

    listeners.push(
      push.addListener("registration", (data) => {
        const token = (data as { value?: string }).value;
        if (!token) return;
        fetch("/api/push/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, platform }),
        }).catch(() => {});
      })
    );
    listeners.push(
      push.addListener("pushNotificationActionPerformed", (action) => {
        const n = (action as { notification?: { data?: { url?: string } } }).notification;
        const url = n?.data?.url;
        if (url && url.startsWith("/")) router.push(url);
      })
    );

    (async () => {
      let perm = await push.checkPermissions();
      if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await push.requestPermissions();
      if (perm.receive === "granted") await push.register();
    })().catch(() => {});

    return () => {
      listeners.forEach((l) => l.then((x) => x.remove()).catch(() => {}));
    };
  }, [router]);

  return null;
}
