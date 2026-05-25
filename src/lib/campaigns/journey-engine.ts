/**
 * Journey advancement engine — single source of truth for "which step comes next".
 *
 * Background: the drip processor used to advance a contact with this fallback when
 * a step had no explicit next pointer:
 *
 *     nextStep = steps.find((s) => s.order > currentStep.order);
 *
 * That is correct ONLY for legacy linear campaigns (created before branching existed,
 * which have no pointers at all). In a branching/graph campaign, the END of a branch
 * legitimately has no next pointer — it should TERMINATE. The order-based fallback
 * instead routed the contact into whatever step happened to have the next ordinal
 * number, which is almost always a step in a different branch. That is the "journey
 * does not follow the setup" bug.
 *
 * This module makes the distinction explicit and is shared by all three engines
 * (unified, email, whatsapp) so they can never diverge again.
 */

/**
 * Map each builder node_id to the DB row id it was inserted as, matching on the
 * `order` field — NOT on array position.
 *
 * `INSERT ... RETURNING` does not guarantee rows come back in insertion order, so
 * the previous `insertedSteps[i]` positional match could silently attach every
 * branching pointer to the wrong step. `order` is unique per campaign (assigned
 * `i + 1` by the wizard), so it is a safe key.
 */
export function buildNodeToDbIdMap(
  payloadSteps: { node_id?: string | null; order?: number | null }[],
  insertedSteps: { id: string; order: number }[],
): Map<string, string> {
  const stepsByOrder = new Map<number, string>(insertedSteps.map((s) => [s.order, s.id]));
  const nodeToDbId = new Map<string, string>();
  for (const s of payloadSteps) {
    if (s.node_id != null && s.order != null) {
      const dbId = stepsByOrder.get(s.order);
      if (dbId) nodeToDbId.set(s.node_id, dbId);
    }
  }
  return nodeToDbId;
}

/** Minimal shape every campaign step shares across the three engines. */
export interface JourneyStep {
  id: string;
  order: number;
  step_type?: string | null;
  next_step_id_yes?: string | null;
  next_step_id_no?: string | null;
}

/**
 * A campaign is "legacy linear" only if NONE of the branching machinery is present:
 * no saved flow graph, no branch pointers on any step, and no condition steps.
 * Such campaigns advance purely by `order`. Everything created by the visual
 * builder is a graph campaign and must advance by pointers.
 */
export function isLegacyLinearCampaign(
  flowData: unknown,
  steps: Pick<JourneyStep, "next_step_id_yes" | "next_step_id_no" | "step_type">[],
): boolean {
  if (flowData) return false;
  return steps.every(
    (s) => !s.next_step_id_yes && !s.next_step_id_no && s.step_type !== "condition",
  );
}

/**
 * Resolve the step a contact moves to after `currentStep` (a send step) completes.
 *
 * Rules:
 *  - Follow the explicit `next_step_id_no` pointer when set (this column doubles as
 *    the linear "default next" pointer for send steps).
 *  - Graph campaign + no pointer  => end of branch => return null (terminate).
 *  - Legacy linear + no pointer   => next step by ascending `order`.
 *
 * Loop guards (defensive — a correct save never produces these, but stale/edited
 * data can): a self-pointer or a mutual A<->B pointer is broken. In a graph
 * campaign we terminate (returning into an arbitrary ordinal step would itself be
 * a bleed); in a legacy campaign we skip past the cycle by order, preserving the
 * previous recovery behaviour.
 *
 * Returns the next step, or null when the enrollment should complete.
 */
export function resolveNextStep<T extends JourneyStep>(
  currentStep: T,
  steps: T[],
  stepMap: Map<string, T>,
  isLegacyLinear: boolean,
): T | null {
  const nextByOrder = (): T | null =>
    steps.find((s) => s.order > currentStep.order) ?? null;

  let nextStep: T | undefined;
  if (currentStep.next_step_id_no) {
    nextStep = stepMap.get(currentStep.next_step_id_no);
    // Pointer set but target missing (deleted step): terminate for graph, recover by
    // order for legacy.
    if (!nextStep) return isLegacyLinear ? nextByOrder() : null;
  } else if (isLegacyLinear) {
    return nextByOrder();
  } else {
    // Graph campaign, branch ends here.
    return null;
  }

  // ── Loop guards ──
  // Self loop: step points at itself.
  if (nextStep.id === currentStep.id) {
    if (isLegacyLinear) {
      return steps.find((s) => s.order > currentStep.order && s.id !== currentStep.id) ?? null;
    }
    return null;
  }
  // Mutual loop: A -> B and B -> A.
  if (nextStep.next_step_id_no === currentStep.id) {
    if (isLegacyLinear) {
      const maxOrder = Math.max(currentStep.order, nextStep.order);
      return steps.find((s) => s.order > maxOrder) ?? null;
    }
    return null;
  }

  return nextStep;
}
