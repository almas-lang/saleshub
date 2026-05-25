import { test } from "node:test";
import assert from "node:assert/strict";
import { bfsOrderedActionableNodes, buildJourneyEdges } from "./import.ts";
import type { FlowData } from "./from-flow.ts";

const trig = { id: "t", type: "trigger", data: {} };
const send = (id: string, ch = "whatsapp") => ({ id, type: "unified_send", data: { channel: ch } });
const cond = (id: string, check: string) => ({ id, type: "condition", data: { check } });
const ed = (source: string, target: string, sourceHandle: string | null = null) => ({ source, target, sourceHandle });

test("bfs order matches the original save's emission order", () => {
  const flow: FlowData = {
    nodes: [trig, send("A"), cond("c", "booked"), send("B"), send("C")],
    edges: [ed("t", "A"), ed("A", "c"), ed("c", "B", "yes"), ed("c", "C", "no")],
  };
  assert.deepEqual(bfsOrderedActionableNodes(flow), ["A", "c", "B", "C"]);
});

test("buildJourneyEdges maps builder nodes to step UUIDs by order, in UUID space", () => {
  const flow: FlowData = {
    nodes: [trig, send("A"), cond("c", "booked"), send("B"), send("C")],
    edges: [ed("t", "A"), ed("A", "c"), ed("c", "B", "yes"), ed("c", "C", "no")],
  };
  // db steps: order 1..4 ↔ A, c, B, C
  const steps = [
    { id: "uuid-A", order: 1 },
    { id: "uuid-c", order: 2 },
    { id: "uuid-B", order: 3 },
    { id: "uuid-C", order: 4 },
  ];
  const r = buildJourneyEdges(flow, steps, "camp1", "unified");
  assert.equal(r.entryStepId, "uuid-A");
  const norm = r.edgeRows.map((e) => `${e.from_node}-${e.branch}->${e.to_node}`).sort();
  assert.deepEqual(norm, ["uuid-A-default->uuid-c", "uuid-c-no->uuid-C", "uuid-c-yes->uuid-B"]);
  assert.deepEqual(r.warnings, []);
});
