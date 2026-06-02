/**
 * Convert a builder flow (React Flow nodes + edges, as stored in
 * unified_campaigns.flow_data) into the v2 engine graph.
 *
 * - Collapses `delay` nodes into the delay carried by the next actionable node
 *   (matches how unified_steps store delay_hours/delay_mode).
 * - Resolves edges between actionable nodes (send/condition), carrying the
 *   condition branch from the edge's sourceHandle ("yes"/"no", else "default").
 * - CHAINS parallel siblings: when one source fans out to multiple sends on the
 *   same branch (e.g. trigger → email + WhatsApp), they become an ordered 0-delay
 *   chain so every one fires. This is what the old save layer failed to do, which
 *   orphaned the sibling send.
 *
 * Pure and deterministic — no DB, no clock.
 */

import type { JourneyNode, JourneyEdge, Branch } from "./engine.ts";
import type { WaitSpec, MissingEventPolicy } from "./scheduler.ts";

interface FlowNode { id: string; type: string; data?: Record<string, unknown> }
interface FlowEdge { source: string; target: string; sourceHandle?: string | null }
export interface FlowData { nodes: FlowNode[]; edges: FlowEdge[] }

export interface DerivedGraph {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  triggerId: string | null;
  warnings: string[];
}

export function deriveGraphFromFlow(flow: FlowData, opts: { missingPolicy?: MissingEventPolicy } = {}): DerivedGraph {
  const warnings: string[] = [];
  const nodes = flow?.nodes ?? [];
  const edges = flow?.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outRaw = new Map<string, FlowEdge[]>();
  for (const e of edges) {
    if (!outRaw.has(e.source)) outRaw.set(e.source, []);
    outRaw.get(e.source)!.push(e);
  }

  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return { nodes: [], edges: [], triggerId: null, warnings: ["no_trigger"] };

  const isActionable = (n: FlowNode) => n.type === "unified_send" || n.type === "condition";

  // ── delay accumulation: each actionable node's delay = delays on the path into it ──
  const delayHours = new Map<string, number>();
  const delayMode = new Map<string, string>();
  function walkDelays(id: string, acc: number, lastMode: string, seen: Set<string>) {
    if (seen.has(id)) return;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return;
    if (n.type === "delay") {
      const m = (n.data?.delayMode as string) ?? "after_previous";
      const h = (n.data?.hours as number) ?? 0;
      const newAcc = m === "before_booking" || m === "after_booking" ? h : acc + h;
      for (const e of outRaw.get(id) ?? []) walkDelays(e.target, newAcc, m, seen);
    } else if (isActionable(n)) {
      delayHours.set(id, acc);
      delayMode.set(id, lastMode);
      for (const e of outRaw.get(id) ?? []) walkDelays(e.target, 0, "after_previous", seen);
    } else if (n.type !== "stop") {
      for (const e of outRaw.get(id) ?? []) walkDelays(e.target, acc, lastMode, seen);
    }
  }
  for (const e of outRaw.get(trigger.id) ?? []) walkDelays(e.target, 0, "after_previous", new Set([trigger.id]));

  // ── resolve through delay nodes to the next actionable (or explicit stop) node ──
  function resolve(id: string): string | null {
    const seen = new Set<string>();
    let cur: string | undefined = id;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const n = byId.get(cur);
      if (!n) return null;
      if (isActionable(n) || n.type === "stop") return cur; // stop kept as an explicit terminal
      cur = outRaw.get(cur)?.[0]?.target;
    }
    return null;
  }

  const mkDelay = (id: string): WaitSpec | undefined => {
    const h = delayHours.get(id) ?? 0;
    const m = delayMode.get(id) ?? "after_previous";
    if (m === "before_booking") return { mode: "before_event", event: "booking", hours: h, missingPolicy: opts.missingPolicy ?? "skip" };
    if (m === "after_booking") return { mode: "after_event", event: "booking", hours: h, missingPolicy: opts.missingPolicy ?? "skip" };
    if (h > 0) return { mode: "after_previous", hours: h };
    return undefined;
  };

  // ── v2 nodes ──
  const v2nodes: JourneyNode[] = [{ id: trigger.id, type: "trigger" }];
  for (const n of nodes) {
    if (n.type === "unified_send") {
      v2nodes.push({ id: n.id, type: "send", channel: (n.data?.channel as "email" | "whatsapp") ?? "whatsapp", delay: mkDelay(n.id) });
    } else if (n.type === "condition") {
      v2nodes.push({ id: n.id, type: "condition", condition: { check: n.data?.check as string, value: n.data?.stageId as string | undefined }, delay: mkDelay(n.id) });
    } else if (n.type === "stop") {
      v2nodes.push({ id: n.id, type: "stop" });
    }
  }
  const v2ids = new Set(v2nodes.map((n) => n.id));
  const sourceIds = new Set(v2nodes.filter((n) => n.type !== "stop").map((n) => n.id)); // stops have no out-edges

  // ── raw edges between actionable nodes (+ from trigger) ──
  type RawEdge = { from: string; to: string; branch: Branch };
  let raw: RawEdge[] = [];
  for (const s of sourceIds) {
    for (const e of outRaw.get(s) ?? []) {
      const to = resolve(e.target);
      if (!to || !v2ids.has(to)) continue;
      const branch: Branch = e.sourceHandle === "yes" ? "yes" : e.sourceHandle === "no" ? "no" : "default";
      if (!raw.some((r) => r.from === s && r.to === to && r.branch === branch)) raw.push({ from: s, to, branch });
    }
  }

  // ── chain parallel siblings: (from, branch) with >1 target → ordered 0-delay chain ──
  //
  // The SAME parallel set can be fanned-to from many sources, sometimes with the
  // targets listed in different order. We must linearize it the SAME way every
  // time, or we create reverse edges (cycles) and drop the shared continuation.
  // So: order siblings by a canonical global key (their position in the flow), so
  // the head is always the head and the tail is always the tail everywhere.
  const canonIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const idx = (id: string) => canonIndex.get(id) ?? Number.MAX_SAFE_INTEGER;

  const groups = new Map<string, RawEdge[]>();
  for (const r of raw) {
    const k = `${r.from}::${r.branch}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const removed = new Set<RawEdge>();
  const added: RawEdge[] = [];
  const seenSets = new Map<string, string>(); // member -> set signature, to flag cross-set membership
  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    const targets = [...new Set(list.map((r) => r.to))].sort((a, b) => idx(a) - idx(b)); // canonical order
    const sig = targets.join(",");
    for (const t of targets) {
      const prev = seenSets.get(t);
      if (prev && prev !== sig) warnings.push(`node ${t} belongs to two different parallel sets — chaining may be ambiguous`);
      seenSets.set(t, sig);
    }
    // keep source→head only; drop source→other-siblings
    for (const r of list) if (r.to !== targets[0]) removed.add(r);
    // chain head→…→tail; each non-tail's own default out-edge is replaced by the chain link
    for (let i = 0; i < targets.length - 1; i++) {
      for (const r of raw) if (r.from === targets[i] && r.branch === "default") removed.add(r);
      added.push({ from: targets[i], to: targets[i + 1], branch: "default" });
    }
    // tail (targets[last]) keeps its own default out-edge = the shared continuation
  }
  raw = raw.filter((r) => !removed.has(r)).concat(added);

  // dedupe (the same chain link gets produced once per fanning source)
  const finalEdges: JourneyEdge[] = [];
  const seenEdge = new Set<string>();
  for (const r of raw) {
    const k = `${r.from}::${r.branch}::${r.to}`;
    if (seenEdge.has(k)) continue;
    seenEdge.add(k);
    finalEdges.push({ from: r.from, to: r.to, branch: r.branch });
  }

  // ── validation warnings (non-fatal) ──
  for (const n of v2nodes) {
    if (n.type === "condition") {
      const outs = finalEdges.filter((e) => e.from === n.id);
      if (!outs.some((e) => e.branch === "yes") && !outs.some((e) => e.branch === "no")) {
        warnings.push(`condition ${n.id} has no yes/no branch`);
      }
    }
  }

  return { nodes: v2nodes, edges: finalEdges, triggerId: trigger.id, warnings };
}
