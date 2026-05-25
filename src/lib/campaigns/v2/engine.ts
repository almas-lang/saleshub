/**
 * v2 journey engine — the pure routing core.
 *
 * `runTick` advances one run from its current node as far as it can WITHOUT
 * waiting: it processes the current (already-due) node, then walks forward,
 * emitting every 0-delay send it passes (this is how parallel sends, chained at
 * 0 delay, all fire together), evaluating conditions deterministically, and
 * stopping at the first node whose delay pushes it into the future ("park") or at
 * a terminal ("terminate").
 *
 * Delay model: each node carries its own `delay` (the builder collapses separate
 * wait blocks into the next step — matches `unified_steps.delay_hours/delay_mode`).
 * A node's delay is applied when the journey ARRIVES at it. The starting cursor
 * node is always already-due, so its own delay is not re-applied.
 *
 * Guarantees that fix the old engine:
 *  - Routing follows edges only. No "next by order" fallback. An unmatched
 *    condition branch or a missing edge is an explicit, logged terminal — a
 *    branch leaf ends the run instead of bleeding into a sibling.
 *  - Timing comes from the scheduler with explicit inputs, logged every time.
 *  - Pure: no DB, no `new Date()`. Clock and lookups are injected → replayable.
 */

import { computeWaitTime, type WaitSpec } from "./scheduler.ts";

export type NodeType = "trigger" | "send" | "condition" | "stop";
export type Branch = "default" | "yes" | "no";

export interface ConditionSpec {
  check: string;
  value?: string;
}

export interface JourneyNode {
  id: string;
  type: NodeType;
  channel?: "email" | "whatsapp"; // send nodes
  condition?: ConditionSpec; // condition nodes
  delay?: WaitSpec; // applied when the journey arrives at this node
}

export interface JourneyEdge {
  from: string;
  to: string;
  branch: Branch;
}

export interface Graph {
  nodes: Map<string, JourneyNode>;
  out: Map<string, JourneyEdge[]>;
}

export interface TickContext {
  now: Date;
  evaluateCondition: (spec: ConditionSpec) => boolean;
  /** resolve an event time (e.g. next confirmed booking) for event-relative delays */
  eventTime: (event: string) => Date | null;
}

export interface SendAction {
  nodeId: string;
  channel?: "email" | "whatsapp";
}
export interface ParkAction {
  nodeId: string;
  at: Date;
}
export interface LogEvent {
  type: string;
  nodeId?: string;
  detail?: Record<string, unknown>;
}
export interface TickResult {
  sends: SendAction[];
  park: ParkAction | null;
  terminate: string | null; // reason, or null when parked
  events: LogEvent[];
}

/** When an event-relative delay's event is missing and policy is "hold". */
const HOLD_RECHECK_MS = 60 * 60 * 1000; // 1h

export function buildGraph(nodes: JourneyNode[], edges: JourneyEdge[]): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, JourneyEdge[]>();
  for (const e of edges) {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from)!.push(e);
  }
  return { nodes: nodeMap, out };
}

/** First edge from `nodeId` matching `branch`. Canonical graphs have at most one. */
function pickEdge(graph: Graph, nodeId: string, branch: Branch): { to: string; multiple: boolean } | null {
  const edges = (graph.out.get(nodeId) ?? []).filter((e) => e.branch === branch);
  if (edges.length === 0) return null;
  return { to: edges[0].to, multiple: edges.length > 1 };
}

export function runTick(graph: Graph, startNodeId: string, ctx: TickContext): TickResult {
  const sends: SendAction[] = [];
  const events: LogEvent[] = [];
  const visited = new Set<string>(); // loop guard within this synchronous tick
  let nodeId = startNodeId;

  const done = (reason: string): TickResult => {
    events.push({ type: "cursor_terminated", nodeId, detail: { reason } });
    return { sends, park: null, terminate: reason, events };
  };

  // hard cap so a malformed graph can never hang the worker
  for (let guard = 0; guard < 10_000; guard++) {
    if (visited.has(nodeId)) {
      events.push({ type: "cursor_terminated", nodeId, detail: { reason: "loop_detected" } });
      return { sends, park: null, terminate: "loop_detected", events };
    }
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) {
      events.push({ type: "cursor_terminated", detail: { reason: "node_missing", nodeId } });
      return { sends, park: null, terminate: "node_missing", events };
    }
    events.push({ type: "node_entered", nodeId, detail: { nodeType: node.type } });

    // ── Process the current (already-due) node ──
    let branch: Branch;
    switch (node.type) {
      case "stop":
        return done("stop");
      case "trigger":
        branch = "default";
        break;
      case "send":
        sends.push({ nodeId: node.id, channel: node.channel });
        events.push({ type: "message_enqueued", nodeId, detail: { channel: node.channel } });
        branch = "default";
        break;
      case "condition": {
        const result = ctx.evaluateCondition(node.condition!);
        events.push({ type: "condition_evaluated", nodeId, detail: { check: node.condition?.check, value: node.condition?.value, result } });
        branch = result ? "yes" : "no";
        break;
      }
      default:
        return done("unknown_node_type");
    }

    // ── Pick the outgoing edge. No edge on the taken branch = explicit terminal. ──
    const next = pickEdge(graph, nodeId, branch);
    if (!next) {
      return done(node.type === "condition" ? "condition_unmatched" : node.type === "trigger" ? "empty_journey" : "end_of_branch");
    }
    if (next.multiple) events.push({ type: "warning", nodeId, detail: { reason: "multiple_edges_on_branch", branch } });

    const nextNode = graph.nodes.get(next.to);
    if (!nextNode) {
      nodeId = next.to;
      return done("node_missing");
    }

    // ── Apply the NEXT node's delay (it is applied on arrival). ──
    if (nextNode.delay) {
      const evt = nextNode.delay.event ? ctx.eventTime(nextNode.delay.event) : null;
      const r = computeWaitTime(nextNode.delay, ctx.now, evt);
      events.push({
        type: "delay_computed",
        nodeId: nextNode.id,
        detail: {
          mode: nextNode.delay.mode,
          hours: nextNode.delay.hours,
          event: nextNode.delay.event,
          eventTime: evt ? evt.toISOString() : null,
          result: r.kind,
          at: r.kind === "at" ? r.at.toISOString() : null,
        },
      });
      if (r.kind === "hold") {
        events.push({ type: "send_scheduled", nodeId: nextNode.id, detail: { hold: true } });
        return { sends, park: { nodeId: nextNode.id, at: new Date(ctx.now.getTime() + HOLD_RECHECK_MS) }, terminate: null, events };
      }
      if (r.kind === "at" && r.at.getTime() > ctx.now.getTime()) {
        events.push({ type: "send_scheduled", nodeId: nextNode.id, detail: { at: r.at.toISOString() } });
        return { sends, park: { nodeId: nextNode.id, at: r.at }, terminate: null, events };
      }
      // r.kind === "skip" or computed time already passed → process next node now
    }

    nodeId = next.to;
  }

  events.push({ type: "cursor_terminated", detail: { reason: "guard_exceeded" } });
  return { sends, park: null, terminate: "guard_exceeded", events };
}
