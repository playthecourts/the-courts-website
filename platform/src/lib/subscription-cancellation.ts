import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

/// Scheduling (and un-scheduling) a cancellation on a membership.
///
/// Most subscriptions take `cancel_at` directly. But NextGen legacy-rate
/// memberships are managed by a Subscription Schedule (see
/// scheduleNextGenLegacyTransition in the Stripe webhook), and Stripe rejects
/// any cancellation change on those outright: "The subscription is managed by
/// the subscription schedule …, and updating any cancelation behavior
/// directly is not allowed." That rejection is what showed families an error
/// page when they confirmed cancellation (Kathryn Muhammad, Oct 2026).
///
/// For a scheduled subscription the cancellation lives on the schedule
/// instead: every phase is cut off at the cancel moment and the schedule's
/// end_behavior becomes "cancel". The original phases are saved on the
/// schedule's metadata first, so reversing the cancellation during the notice
/// window restores the exact plan (including the Jan 1 rate step-up).

const SAVED_PHASES_KEY = "preCancelPhases";
const SAVED_END_BEHAVIOR_KEY = "preCancelEndBehavior";

type SavedPhase = {
  s: number; // start_date
  e?: number; // end_date (absent on an open-ended last phase)
  p: string; // price id
  q: number; // quantity
  pr?: Stripe.SubscriptionScheduleUpdateParams.Phase.ProrationBehavior;
  c?: string[]; // coupon ids
  d?: string[]; // discount ids
};

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function snapshotPhases(schedule: Stripe.SubscriptionSchedule): SavedPhase[] {
  return schedule.phases.map((phase) => {
    const item = phase.items[0];
    const coupons = phase.discounts.map((d) => idOf(d.coupon)).filter((x): x is string => !!x);
    const discounts = phase.discounts.map((d) => idOf(d.discount)).filter((x): x is string => !!x);
    return {
      s: phase.start_date,
      e: phase.end_date ?? undefined,
      p: idOf(item.price)!,
      q: item.quantity ?? 1,
      pr: phase.proration_behavior ?? undefined,
      ...(coupons.length ? { c: coupons } : {}),
      ...(discounts.length ? { d: discounts } : {}),
    };
  });
}

function toPhaseParams(saved: SavedPhase[]): Stripe.SubscriptionScheduleUpdateParams.Phase[] {
  return saved.map((phase) => ({
    items: [{ price: phase.p, quantity: phase.q }],
    start_date: phase.s,
    ...(phase.e ? { end_date: phase.e } : {}),
    ...(phase.pr ? { proration_behavior: phase.pr } : {}),
    ...(phase.d?.length
      ? { discounts: phase.d.map((discount) => ({ discount })) }
      : phase.c?.length
        ? { discounts: phase.c.map((coupon) => ({ coupon })) }
        : {}),
  }));
}

async function scheduleFor(subscriptionId: string): Promise<Stripe.SubscriptionSchedule | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const scheduleId = idOf(subscription.schedule);
  if (!scheduleId) return null;
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  // A released/completed/canceled schedule no longer manages the subscription.
  return schedule.status === "active" || schedule.status === "not_started" ? schedule : null;
}

/// Schedules the subscription to end at `cancelAt` (unix seconds). Billing
/// continues normally until then, including a renewal inside the window.
export async function scheduleSubscriptionCancellation(subscriptionId: string, cancelAt: number) {
  const schedule = await scheduleFor(subscriptionId);
  if (!schedule) {
    await stripe.subscriptions.update(subscriptionId, { cancel_at: cancelAt });
    return;
  }

  const original = snapshotPhases(schedule);
  // Keep any earlier snapshot — re-confirming a cancellation must not
  // overwrite the real pre-cancel plan with an already-truncated one.
  const savedPhases = schedule.metadata?.[SAVED_PHASES_KEY] ?? JSON.stringify(original);
  const savedEndBehavior = schedule.metadata?.[SAVED_END_BEHAVIOR_KEY] ?? schedule.end_behavior;

  const truncated = original
    .filter((phase) => phase.s < cancelAt)
    .map((phase) => ({ ...phase, e: phase.e ? Math.min(phase.e, cancelAt) : cancelAt }));
  truncated[truncated.length - 1].e = cancelAt;

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "cancel",
    phases: toPhaseParams(truncated),
    metadata: { [SAVED_PHASES_KEY]: savedPhases, [SAVED_END_BEHAVIOR_KEY]: savedEndBehavior },
  });
}

/// Undoes scheduleSubscriptionCancellation during the notice window.
export async function reverseSubscriptionCancellation(subscriptionId: string) {
  const schedule = await scheduleFor(subscriptionId);
  if (!schedule) {
    await stripe.subscriptions.update(subscriptionId, { cancel_at: null });
    return;
  }

  const saved = schedule.metadata?.[SAVED_PHASES_KEY];
  if (!saved) {
    // Scheduled but never cancelled through this app — nothing to restore.
    if (schedule.end_behavior === "cancel") {
      throw new Error("This membership's cancellation was set in Stripe directly — reverse it there.");
    }
    return;
  }

  const phases = JSON.parse(saved) as SavedPhase[];
  const endBehavior = (schedule.metadata?.[SAVED_END_BEHAVIOR_KEY] ?? "release") as Stripe.SubscriptionScheduleUpdateParams.EndBehavior;

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: endBehavior,
    phases: toPhaseParams(phases),
    metadata: { [SAVED_PHASES_KEY]: "", [SAVED_END_BEHAVIOR_KEY]: "" },
  });
}

/// When a cancellation lives on a schedule, Stripe may leave
/// subscription.cancel_at empty — read the end date off the schedule so the
/// webhook sync doesn't wipe the app's "cancels on …" state.
export async function effectiveCancelAt(subscription: Stripe.Subscription): Promise<number | null> {
  if (subscription.cancel_at) return subscription.cancel_at;
  const scheduleId = idOf(subscription.schedule);
  if (!scheduleId) return null;
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  if (schedule.end_behavior !== "cancel" || schedule.status !== "active") return null;
  return schedule.phases[schedule.phases.length - 1]?.end_date ?? null;
}
