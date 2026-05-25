import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNextStep, isLegacyLinearCampaign, buildNodeToDbIdMap, type JourneyStep } from "./journey-engine.ts";

function mk(steps: JourneyStep[]) {
  return { steps, map: new Map(steps.map((s) => [s.id, s])) };
}

// ──────────────────────────────────────────────────────────────────────────
// The core bug: a branch leaf in a graph campaign must TERMINATE, not bleed
// into the next step by order.
// ──────────────────────────────────────────────────────────────────────────
test("graph: branch leaf with no next pointer terminates (no bleed)", () => {
  // cond(order1) --yes--> Y(order2, leaf) ; --no--> N(order3, leaf)
  const Y: JourneyStep = { id: "Y", order: 2, step_type: "send", next_step_id_yes: null, next_step_id_no: null };
  const N: JourneyStep = { id: "N", order: 3, step_type: "send", next_step_id_yes: null, next_step_id_no: null };
  const cond: JourneyStep = { id: "C", order: 1, step_type: "condition", next_step_id_yes: "Y", next_step_id_no: "N" };
  const { steps, map } = mk([cond, Y, N]);

  // Contact went down the YES branch and finished Y. Old logic would find order>2 => N (BLEED).
  const next = resolveNextStep(Y, steps, map, /*isLegacyLinear*/ false);
  assert.equal(next, null, "Y is a branch leaf; enrollment must complete, not advance to N");
});

test("graph: explicit next pointer is followed", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "B" };
  const B: JourneyStep = { id: "B", order: 2, step_type: "send", next_step_id_no: null };
  const { steps, map } = mk([A, B]);
  const next = resolveNextStep(A, steps, map, false);
  assert.equal(next?.id, "B");
});

test("graph: diamond reconvergence — both branches point to the same step", () => {
  // A --no--> C , B --no--> C ; C is shared tail
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "C" };
  const B: JourneyStep = { id: "B", order: 2, step_type: "send", next_step_id_no: "C" };
  const C: JourneyStep = { id: "C", order: 3, step_type: "send", next_step_id_no: null };
  const { steps, map } = mk([A, B, C]);
  assert.equal(resolveNextStep(A, steps, map, false)?.id, "C");
  assert.equal(resolveNextStep(B, steps, map, false)?.id, "C");
  assert.equal(resolveNextStep(C, steps, map, false), null, "tail terminates");
});

test("graph: dangling pointer (target deleted) terminates", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "GONE" };
  const { steps, map } = mk([A]);
  assert.equal(resolveNextStep(A, steps, map, false), null);
});

// ──────────────────────────────────────────────────────────────────────────
// Legacy linear campaigns must keep advancing by order.
// ──────────────────────────────────────────────────────────────────────────
test("legacy: no pointers advances by order", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send" };
  const B: JourneyStep = { id: "B", order: 2, step_type: "send" };
  const C: JourneyStep = { id: "C", order: 3, step_type: "send" };
  const { steps, map } = mk([A, B, C]);
  assert.equal(resolveNextStep(A, steps, map, /*isLegacyLinear*/ true)?.id, "B");
  assert.equal(resolveNextStep(B, steps, map, true)?.id, "C");
  assert.equal(resolveNextStep(C, steps, map, true), null, "last step completes");
});

// ──────────────────────────────────────────────────────────────────────────
// Loop guards.
// ──────────────────────────────────────────────────────────────────────────
test("graph: self-loop terminates", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "A" };
  const { steps, map } = mk([A]);
  assert.equal(resolveNextStep(A, steps, map, false), null);
});

test("graph: mutual A<->B loop terminates", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "B" };
  const B: JourneyStep = { id: "B", order: 2, step_type: "send", next_step_id_no: "A" };
  const { steps, map } = mk([A, B]);
  assert.equal(resolveNextStep(A, steps, map, false), null);
});

test("legacy: mutual loop recovers by skipping past both", () => {
  const A: JourneyStep = { id: "A", order: 1, step_type: "send", next_step_id_no: "B" };
  const B: JourneyStep = { id: "B", order: 2, step_type: "send", next_step_id_no: "A" };
  const C: JourneyStep = { id: "C", order: 3, step_type: "send" };
  const { steps, map } = mk([A, B, C]);
  assert.equal(resolveNextStep(A, steps, map, true)?.id, "C");
});

// ──────────────────────────────────────────────────────────────────────────
// isLegacyLinearCampaign classification.
// ──────────────────────────────────────────────────────────────────────────
test("classify: flow_data present => graph", () => {
  assert.equal(isLegacyLinearCampaign({ nodes: [] }, [{ next_step_id_no: null, next_step_id_yes: null, step_type: "send" }]), false);
});

test("classify: any pointer => graph", () => {
  assert.equal(isLegacyLinearCampaign(null, [{ next_step_id_no: "X", next_step_id_yes: null, step_type: "send" }]), false);
});

test("classify: any condition step => graph", () => {
  assert.equal(isLegacyLinearCampaign(null, [{ next_step_id_no: null, next_step_id_yes: null, step_type: "condition" }]), false);
});

test("classify: no flow_data, no pointers, no conditions => legacy linear", () => {
  assert.equal(isLegacyLinearCampaign(null, [
    { next_step_id_no: null, next_step_id_yes: null, step_type: "send" },
    { next_step_id_no: null, next_step_id_yes: null, step_type: "send" },
  ]), true);
});

// ──────────────────────────────────────────────────────────────────────────
// buildNodeToDbIdMap: must match by `order`, not array position. This is the
// pointer-corruption bug — Postgres can return inserted rows in any order.
// ──────────────────────────────────────────────────────────────────────────
test("mapping: matches by order even when DB returns rows out of insertion order", () => {
  const payload = [
    { node_id: "nodeA", order: 1 },
    { node_id: "nodeB", order: 2 },
    { node_id: "nodeC", order: 3 },
  ];
  // DB returned them shuffled (order 3, 1, 2) — positional mapping would mis-assign every pointer.
  const inserted = [
    { id: "db-C", order: 3 },
    { id: "db-A", order: 1 },
    { id: "db-B", order: 2 },
  ];
  const map = buildNodeToDbIdMap(payload, inserted);
  assert.equal(map.get("nodeA"), "db-A");
  assert.equal(map.get("nodeB"), "db-B");
  assert.equal(map.get("nodeC"), "db-C");
});

test("mapping: skips steps with no node_id or order", () => {
  const map = buildNodeToDbIdMap(
    [{ node_id: null, order: 1 }, { node_id: "x", order: undefined }],
    [{ id: "db-1", order: 1 }],
  );
  assert.equal(map.size, 0);
});
