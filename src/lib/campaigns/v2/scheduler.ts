/**
 * v2 scheduler — pure, deterministic computation of WHEN a wait resolves.
 *
 * The old engine bolted booking-relative timing onto step advancement and fell
 * back to `now + delay` silently when the booking lookup returned nothing — which
 * sent "24h before the call" reminders ~45h early. Here the computation is pure,
 * the inputs are explicit, and a missing event follows a declared policy instead
 * of a silent fallback. The caller logs the inputs + result to the event log.
 */

export type WaitMode = "after_previous" | "before_event" | "after_event";
export type MissingEventPolicy = "skip" | "hold" | "send_now";

export interface WaitSpec {
  mode: WaitMode;
  /** event key the wait is relative to, e.g. "booking". Omit for after_previous. */
  event?: string;
  hours: number;
  /** what to do when an event-relative wait has no event. Default: "skip". */
  missingPolicy?: MissingEventPolicy;
}

export type WaitResult =
  | { kind: "at"; at: Date }      // resume the journey at this time
  | { kind: "skip" }              // skip this wait, continue immediately
  | { kind: "hold" };             // event missing + policy=hold: stay put, re-check next tick

const HOUR_MS = 3_600_000;

/**
 * Compute when a wait resolves.
 *
 * @param spec       the wait configuration
 * @param now        the engine clock (injected — never `new Date()` inside)
 * @param eventTime  resolved event time (e.g. next confirmed booking), or null
 */
export function computeWaitTime(spec: WaitSpec, now: Date, eventTime: Date | null): WaitResult {
  const hoursMs = (spec.hours ?? 0) * HOUR_MS;

  if (spec.mode === "after_previous") {
    return { kind: "at", at: new Date(now.getTime() + hoursMs) };
  }

  // event-relative
  if (!eventTime) {
    switch (spec.missingPolicy ?? "skip") {
      case "send_now": return { kind: "at", at: now };
      case "hold":     return { kind: "hold" };
      case "skip":
      default:         return { kind: "skip" };
    }
  }

  const base = eventTime.getTime();
  const target = spec.mode === "before_event" ? base - hoursMs : base + hoursMs;
  // Never schedule into the past: if the window already passed, resume now.
  return { kind: "at", at: new Date(Math.max(target, now.getTime())) };
}
