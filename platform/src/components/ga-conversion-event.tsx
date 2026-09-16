"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const FB_EVENT_NAME: Record<"purchase" | "sign_up", string> = {
  purchase: "Purchase",
  sign_up: "CompleteRegistration",
};

/// Fires both a GA4 event and the matching Meta Pixel standard event, once,
/// on mount — dropped into a success screen (membership purchase, League
/// registration, a paid booking) alongside the confirmation banner that
/// already renders there. `once` via a ref rather than relying on the parent
/// only rendering this on a fresh success, since a client-side navigation
/// back to the same URL (browser back/forward) shouldn't double-count a
/// purchase that already fired.
export function GaConversionEvent({
  event,
  valueCents,
  transactionId,
  itemName,
}: {
  event: "purchase" | "sign_up";
  valueCents?: number | null;
  transactionId?: string | null;
  itemName?: string | null;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (typeof window.gtag === "function") {
      window.gtag("event", event, {
        currency: "USD",
        ...(valueCents != null ? { value: valueCents / 100 } : {}),
        ...(transactionId ? { transaction_id: transactionId } : {}),
        ...(itemName ? { items: [{ item_name: itemName }] } : {}),
      });
    }

    if (typeof window.fbq === "function") {
      window.fbq("track", FB_EVENT_NAME[event], {
        currency: "USD",
        ...(valueCents != null ? { value: valueCents / 100 } : {}),
        ...(itemName ? { content_name: itemName } : {}),
      });
    }
  }, [event, valueCents, transactionId, itemName]);

  return null;
}
