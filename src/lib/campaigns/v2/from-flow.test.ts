import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveGraphFromFlow, type FlowData } from "./from-flow.ts";
import { buildGraph } from "./engine.ts";
import { simulate } from "./sim.ts";

const send = (id: string, channel = "whatsapp") => ({ id, type: "unified_send", data: { channel } });
const cond = (id: string, check: string) => ({ id, type: "condition", data: { check } });
const trig = { id: "t", type: "trigger", data: {} };
const stop = (id: string) => ({ id, type: "stop", data: {} });
const ed = (source: string, target: string, sourceHandle: string | null = null) => ({ source, target, sourceHandle });

const reachableSends = (flow: FlowData) => {
  const d = deriveGraphFromFlow(flow);
  const adj = new Map<string, string[]>();
  for (const e of d.edges) (adj.get(e.from) ?? adj.set(e.from, []).get(e.from))!.push(e.to);
  const seen = new Set([d.triggerId!]); const q = [d.triggerId!];
  while (q.length) { const x = q.shift()!; for (const t of adj.get(x) ?? []) if (!seen.has(t)) { seen.add(t); q.push(t); } }
  return { d, orphanSends: d.nodes.filter((n) => n.type === "send" && !seen.has(n.id)).map((n) => n.id) };
};

test("converter: parallel sends at trigger are chained, none orphaned", () => {
  const flow: FlowData = {
    nodes: [trig, send("A", "email"), send("B", "whatsapp"), send("C")],
    edges: [ed("t", "A"), ed("t", "B"), ed("A", "C"), ed("B", "C")],
  };
  const { d, orphanSends } = reachableSends(flow);
  assert.deepEqual(orphanSends, [], "no orphaned sends");
  const r = simulate(buildGraph(d.nodes, d.edges), { start: new Date("2026-01-01T00:00:00Z"), startNodeId: d.triggerId! });
  assert.deepEqual(r.sends.map((s) => s.nodeId), ["A", "B", "C"]);
});

test("converter: reused parallel pair listed in INCONSISTENT order chains canonically (no cycle, no orphan)", () => {
  // This is the real-campaign bug: cond1 yes→[X,Y], cond2 yes→[Y,X]. X and Y both → Z.
  const flow: FlowData = {
    nodes: [trig, cond("c1", "booked"), cond("c2", "booked"), send("X"), send("Y"), send("Z")],
    edges: [
      ed("t", "c1"),
      ed("c1", "X", "yes"), ed("c1", "Y", "yes"), ed("c1", "c2", "no"),
      ed("c2", "Y", "yes"), ed("c2", "X", "yes"), // <-- opposite order
      ed("X", "Z"), ed("Y", "Z"),
    ],
  };
  const { d, orphanSends } = reachableSends(flow);
  assert.deepEqual(orphanSends, [], "Z must not be orphaned");
  // no reverse edge X<->Y both directions
  const xy = d.edges.some((e) => e.from === "X" && e.to === "Y");
  const yx = d.edges.some((e) => e.from === "Y" && e.to === "X");
  assert.ok(!(xy && yx), "must not chain both X→Y and Y→X (that was the cycle)");

  // simulate: condition true → X, Y, Z all fire, no loop
  const r = simulate(buildGraph(d.nodes, d.edges), {
    start: new Date("2026-01-01T00:00:00Z"), startNodeId: d.triggerId!, evaluateCondition: () => true,
  });
  assert.deepEqual(r.sends.map((s) => s.nodeId), ["X", "Y", "Z"]);
  assert.notEqual(r.terminate, "loop_detected");
});

test("converter: stop node becomes an explicit stop terminal", () => {
  const flow: FlowData = {
    nodes: [trig, send("A"), stop("s")],
    edges: [ed("t", "A"), ed("A", "s")],
  };
  const d = deriveGraphFromFlow(flow);
  const r = simulate(buildGraph(d.nodes, d.edges), { start: new Date("2026-01-01T00:00:00Z"), startNodeId: d.triggerId! });
  assert.deepEqual(r.sends.map((s) => s.nodeId), ["A"]);
  assert.equal(r.terminate, "stop");
});
