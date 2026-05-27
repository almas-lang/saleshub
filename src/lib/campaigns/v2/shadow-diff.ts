/**
 * Pure divergence check for shadow mode. Kept in its own module so tests can
 * import it without dragging in the supabase admin client (which Node's test
 * runner can't resolve via Next.js path aliases).
 */
/** Minimal shape needed for divergence check. Kept local so this module has zero imports. */
export interface ShadowPlan {
  sends: { stepId: string; channel?: string }[];
  park: { stepId: string; at: string } | null;
  terminate: string | null;
}

/** Predicted vs actual is divergent if v2 would park on a different step or fire sends legacy isn't queued to fire. */
export function isDivergent(
  plan: ShadowPlan,
  legacy: { current_step_id: string | null; next_send_at: string | null },
  nowMs: number,
): boolean {
  if (plan.park && plan.park.stepId !== legacy.current_step_id) return true;
  if (plan.terminate && legacy.current_step_id) return true;
  if (plan.sends.length) {
    const dueAt = legacy.next_send_at ? new Date(legacy.next_send_at).getTime() : 0;
    if (dueAt > nowMs + 60_000) return true;
  }
  return false;
}
