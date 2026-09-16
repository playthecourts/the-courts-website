"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/// Fires a GA4 conversion event once, on mount — dropped into a success
/// screen (membership purchase, League registration, a paid booking)
/// alongside the confirmation banner that already renders there. `once` via
/// a ref rather than relying on the parent only rendering this on a fresh
/// success, since a client-side navigation back to the same URL (browser
/// back/forward) shouldn't double-count a purchase that already fired.
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
    if (typeof window.gtag !== "function") return;

    window.gtag("event", event, {
      currency: "USD",
      ...(valueCents != null ? { value: valueCents / 100 } : {}),
      ...(transactionId ? { transaction_id: transactionId } : {}),
      ...(itemName ? { items: [{ item_name: itemName }] } : {}),
    });
  }, [event, valueCents, transactionId, itemName]);

  return null;
}
