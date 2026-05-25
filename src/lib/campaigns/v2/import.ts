/**
 * Import an existing campaign onto the v2 engine.
 *
 * The v2 graph the worker runs is keyed by `unified_steps` UUIDs (which is what
 * drip_enrollments.current_step_id already references). The converter
 * (deriveGraphFromFlow) works in builder-node-id space, so we map builder node →
 * unified_steps UUID by replaying the SAME BFS emission order the original save
 * used to assign `unified_steps.order`. That makes order[i] ↔ the i-th saved step.
 *
 * Output: journey_edges rows (UUID space) + the entry step id, ready to insert.
 */

import { deriveGraphFromFlow, type FlowData } from "./from-flow.ts";
import type { MissingEventPolicy } from "./scheduler.ts";

export interface StepRow {
  id: string;
  order: number;
}
export interface EdgeRow {
  campaign_id: string;
  campaign_type: string;
  from_node: string; // unified_steps UUID
  to_node: string; // unified_steps UUID
  branch: "default" | "yes" | "no";
}
export interface ImportResult {
  edgeRows: EdgeRow[];
  entryStepId: string | null;
  warnings: string[];
}

/**
 * Replay the original save's BFS to list actionable builder nodes (send/condition)
 * in emission order — index i ↔ unified_steps.order = i + 1.
 * Mirrors flowToUnifiedStepsWithBranching's traversal exactly.
 */
export function bfsOrderedActionableNodes(flow: FlowData): string[] {
  const nodes = flow?.nodes ?? [];
  const edges = flow?.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, { target: string }[]>();
  for (const e of edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source)!.push({ target: e.target });
  }
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return [];

  const emitted = new Set<string>();
  const queue = (out.get(trigger.id) ?? []).map((e) => e.target);
  const result: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (emitted.has(id)) continue;
    emitted.add(id);
    const n = byId.get(id);
    if (!n) continue;
    if (n.type === "unified_send" || n.type === "condition") {
      result.push(id);
      for (const e of out.get(id) ?? []) queue.push(e.target);
    } else if (n.type === "delay") {
      for (const e of out.get(id) ?? []) queue.push(e.target);
    }
    // stop / other: emit nothing, enqueue nothing
  }
  return result;
}

export function buildJourneyEdges(
  flow: FlowData,
  steps: StepRow[],
  campaignId: string,
  campaignType: string,
  opts: { missingPolicy?: MissingEventPolicy } = {},
): ImportResult {
  const warnings: string[] = [];
  const derived = deriveGraphFromFlow(flow, opts);

  // builder node id -> unified_steps UUID, by matching BFS order to step.order
  const ordered = bfsOrderedActionableNodes(flow);
  const stepsByOrder = new Map(steps.map((s) => [s.order, s.id]));
  const nodeToUuid = new Map<string, string>();
  ordered.forEach((flowId, i) => {
    const uuid = stepsByOrder.get(i + 1);
    if (uuid) nodeToUuid.set(flowId, uuid);
  });
  if (ordered.length !== steps.length) {
    warnings.push(`actionable node count (${ordered.length}) != stored step count (${steps.length}) — mapping may be off`);
  }

  // translate converter edges (builder-id space) to UUID space.
  // Drop edges out of the trigger (no UUID) and edges into stop nodes (no UUID) —
  // a dropped onward edge already terminates the run in the engine.
  const edgeRows: EdgeRow[] = [];
  for (const e of derived.edges) {
    if (e.from === derived.triggerId) continue; // entry handled via enrollment cursor
    const from = nodeToUuid.get(e.from);
    const to = nodeToUuid.get(e.to);
    if (!from || !to) continue; // to a stop / unmapped → terminal, no edge needed
    edgeRows.push({ campaign_id: campaignId, campaign_type: campaignType, from_node: from, to_node: to, branch: e.branch });
  }

  // entry = the trigger's (chained) default target → its UUID
  const entryFlowId = derived.edges.find((e) => e.from === derived.triggerId && e.branch === "default")?.to ?? null;
  const entryStepId = entryFlowId ? nodeToUuid.get(entryFlowId) ?? null : null;

  return { edgeRows, entryStepId, warnings: [...warnings, ...derived.warnings] };
}
