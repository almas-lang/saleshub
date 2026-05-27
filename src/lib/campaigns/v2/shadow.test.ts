import { test } from "node:test";
import assert from "node:assert/strict";
import { isDivergent, type ShadowPlan } from "./shadow-diff.ts";

const nowMs = new Date("2026-05-27T10:00:00Z").getTime();

const plan = (over: Partial<ShadowPlan> = {}): ShadowPlan => ({
  sends: [], park: null, terminate: null, ...over,
});

test("matching park step is not divergent", () => {
  assert.equal(
    isDivergent(plan({ park: { stepId: "s1", at: "2026-05-28T10:00:00Z" } }), { current_step_id: "s1", next_send_at: null }, nowMs),
    false,
  );
});

test("park on a different step is divergent", () => {
  assert.equal(
    isDivergent(plan({ park: { stepId: "s2", at: "2026-05-28T10:00:00Z" } }), { current_step_id: "s1", next_send_at: null }, nowMs),
    true,
  );
});

test("v2 terminates while legacy still has a cursor → divergent", () => {
  assert.equal(
    isDivergent(plan({ terminate: "end_of_branch" }), { current_step_id: "s1", next_send_at: null }, nowMs),
    true,
  );
});

test("v2 wants to fire now but legacy is parked far in the future → divergent", () => {
  const futureIso = new Date(nowMs + 60 * 60 * 1000).toISOString();
  assert.equal(
    isDivergent(plan({ sends: [{ stepId: "s1", channel: "email" }] }), { current_step_id: "s1", next_send_at: futureIso }, nowMs),
    true,
  );
});

test("v2 and legacy both ready to fire → not divergent", () => {
  const dueIso = new Date(nowMs - 1000).toISOString();
  assert.equal(
    isDivergent(plan({ sends: [{ stepId: "s1", channel: "email" }] }), { current_step_id: "s1", next_send_at: dueIso }, nowMs),
    false,
  );
});
