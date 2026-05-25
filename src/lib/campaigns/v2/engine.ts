/**
 * v2 journey engine — the pure routing core.
 *
 * `runTick` advances one run from its current node as far as it can WITHOUT
 * waiting: it emits every 0-delay send it passes (this is how parallel sends,
 * chained at 0 delay, all fire together), evaluates conditions deterministically,
 * and stops at the first future wait ("park") or at a terminal ("terminate").
 *
 * Guarantees that fix the old engine:
 *  - Routing follows edges only. There is NO "next by order" fallback. An
 *    unmatched condition branch or a missing edge is an explicit, logged
 *    terminal — a branch leaf ends the run instead of bleeding into a sibling.
 *  - Timing comes from the scheduler with explicit inputs, logged every time.
 *  - Pure: no DB, no `new Date()`. The clock and all lookups are injected, so the
 *    whole thing is replayable in the simulation harness.
 */

import { computeWaitTime, type WaitSpec } from "./scheduler.ts";

export type NodeType = "trigger" | "send" | "wait" | "condition" | "stop";
export type Branch = "default" | "yes" | "no";

export interface ConditionSpec {
  check: string;
  value?: string;
}

export interface JourneyNode {
  id: string;
  type: NodeType;
  channel?: "email" | "whatsapp"; // send nodes
  wait?: WaitSpec; // wait nodes
  condition?: ConditionSpec; // condition nodes
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
  /** resolve an event time (e.g. next confirmed booking) for event-relative waits */
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

/** When a wait's event is missing and policy is "hold", re-check this soon. */
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
  let scheduledAt = ctx.now;

  // hard cap so a malformed graph can never hang the worker
  for (let guard = 0; guard < 10_000; guard++) {
    // Park as soon as a wait pushed us into the future — resume here next time.
    if (scheduledAt.getTime() > ctx.now.getTime()) {
      events.push({ type: "send_scheduled", nodeId, detail: { at: scheduledAt.toISOString() } });
      return { sends, park: { nodeId, at: scheduledAt }, terminate: null, events };
    }
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

    switch (node.type) {
      case "stop":
        events.push({ type: "cursor_terminated", nodeId, detail: { reason: "stop" } });
        return { sends, park: null, terminate: "stop", events };

      case "trigger": {
        const next = pickEdge(graph, nodeId, "default");
        if (!next) return done("empty_journey");
        nodeId = next.to;
        break;
      }

      case "send": {
        sends.push({ nodeId: node.id, channel: node.channel });
        events.push({ type: "message_enqueued", nodeId, detail: { channel: node.channel } });
        const next = pickEdge(graph, nodeId, "default");
        if (next?.multiple) events.push({ type: "warning", nodeId, detail: { reason: "multiple_default_edges" } });
        if (!next) return done("end_of_branch");
        nodeId = next.to; // scheduledAt stays = now → next node processed this tick
        break;
      }

      case "condition": {
        const result = ctx.evaluateCondition(node.condition!);
        events.push({ type: "condition_evaluated", nodeId, detail: { check: node.condition?.check, value: node.condition?.value, result } });
        const next = pickEdge(graph, nodeId, result ? "yes" : "no");
        if (!next) {
          // EXPLICIT terminal — no fallback. This is what kills the leaf-bleed.
          events.push({ type: "cursor_terminated", nodeId, detail: { reason: "condition_unmatched", branch: result ? "yes" : "no" } });
          return { sends, park: null, terminate: "condition_unmatched", events };
        }
        nodeId = next.to;
        break;
      }

      case "wait": {
        const evt = node.wait?.event ? ctx.eventTime(node.wait.event) : null;
        const r = computeWaitTime(node.wait!, ctx.now, evt);
        events.push({
          type: "wait_computed",
          nodeId,
          detail: {
            mode: node.wait?.mode,
            hours: node.wait?.hours,
            event: node.wait?.event,
            eventTime: evt ? evt.toISOString() : null,
            result: r.kind,
            at: r.kind === "at" ? r.at.toISOString() : null,
          },
        });
        if (r.kind === "hold") {
          return { sends, park: { nodeId, at: new Date(ctx.now.getTime() + HOLD_RECHECK_MS) }, terminate: null, events };
        }
        const next = pickEdge(graph, nodeId, "default");
        if (!next) return done("end_of_branch");
        if (r.kind === "skip") {
          nodeId = next.to; // skip the wait, process next now
          break;
        }
        scheduledAt = r.at; // "at" — will park at next node on the next loop iteration
        nodeId = next.to;
        break;
      }

      default:
        return done("unknown_node_type");
    }
  }

  events.push({ type: "cursor_terminated", detail: { reason: "guard_exceeded" } });
  return { sends, park: null, terminate: "guard_exceeded", events };

  function done(reason: string): TickResult {
    events.push({ type: "cursor_terminated", nodeId, detail: { reason } });
    return { sends, park: null, terminate: reason, events };
  }
}
