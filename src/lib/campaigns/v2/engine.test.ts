import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, type JourneyNode, type JourneyEdge } from "./engine.ts";
import { simulate } from "./sim.ts";

// ── tiny builders ──
const N = (id: string, type: JourneyNode["type"], extra: Partial<JourneyNode> = {}): JourneyNode => ({ id, type, ...extra });
const E = (from: string, to: string, branch: JourneyEdge["branch"] = "default"): JourneyEdge => ({ from, to, branch });
const iso = (s: string) => new Date(s);
const sendIds = (r: { sends: { nodeId: string }[] }) => r.sends.map((s) => s.nodeId);

// ──────────────────────────────────────────────────────────────────────────
// Linear
// ──────────────────────────────────────────────────────────────────────────
test("linear: both sends fire, run ends at branch leaf", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("s1", "send", { channel: "email" }), N("s2", "send", { channel: "whatsapp" })],
    [E("t", "s1"), E("s1", "s2")],
  );
  const r = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t" });
  assert.deepEqual(sendIds(r), ["s1", "s2"]);
  assert.equal(r.terminate, "end_of_branch");
});

// ──────────────────────────────────────────────────────────────────────────
// THE leaf-bleed regression: a branch leaf must NOT bleed into the sibling.
// ──────────────────────────────────────────────────────────────────────────
test("branch: yes-leaf terminates, does NOT bleed into no-branch", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("c", "condition", { condition: { check: "booked" } }),
     N("yes", "send", { channel: "whatsapp" }), N("no", "send", { channel: "email" })],
    [E("t", "c"), E("c", "yes", "yes"), E("c", "no", "no")],
  );
  const yes = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => true });
  assert.deepEqual(sendIds(yes), ["yes"], "only the yes-branch send fires");
  const no = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => false });
  assert.deepEqual(sendIds(no), ["no"], "only the no-branch send fires");
});

// ──────────────────────────────────────────────────────────────────────────
// Diamond reconvergence
// ──────────────────────────────────────────────────────────────────────────
test("diamond: both branches rejoin at shared tail", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("c", "condition", { condition: { check: "x" } }),
     N("a", "send"), N("b", "send"), N("tail", "send")],
    [E("t", "c"), E("c", "a", "yes"), E("c", "b", "no"), E("a", "tail"), E("b", "tail")],
  );
  assert.deepEqual(sendIds(simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => true })), ["a", "tail"]);
  assert.deepEqual(sendIds(simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => false })), ["b", "tail"]);
});

// ──────────────────────────────────────────────────────────────────────────
// Parallel sends (chained at 0 delay) — fixes the #2/#14 orphan class
// ──────────────────────────────────────────────────────────────────────────
test("parallel: email + whatsapp at start both fire in the same tick", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("email", "send", { channel: "email" }), N("wa", "send", { channel: "whatsapp" }), N("next", "send")],
    [E("t", "email"), E("email", "wa"), E("wa", "next")],
  );
  const r = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t" });
  assert.deepEqual(sendIds(r), ["email", "wa", "next"]);
  // all three fire at the same instant (0 delay)
  assert.equal(r.sends[0].at.getTime(), r.sends[1].at.getTime());
  assert.equal(r.sends[1].at.getTime(), r.sends[2].at.getTime());
});

// ──────────────────────────────────────────────────────────────────────────
// THE reminder regression: 24h-before-call reminder fires 24h before the call,
// not 24h after the previous message.
// ──────────────────────────────────────────────────────────────────────────
test("reminder: before_event fires relative to the booking, not the previous step", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("confirm", "send", { channel: "whatsapp" }),
     N("w24", "wait", { wait: { mode: "before_event", event: "booking", hours: 24 } }),
     N("rem", "send", { channel: "whatsapp" })],
    [E("t", "confirm"), E("confirm", "w24"), E("w24", "rem")],
  );
  const start = iso("2026-05-24T07:00:00Z");          // Natasha's confirm time
  const call = iso("2026-05-27T04:30:00Z");           // Wednesday call
  const r = simulate(g, { start, startNodeId: "t", eventTime: () => call });
  assert.deepEqual(sendIds(r), ["confirm", "rem"]);
  assert.equal(r.sends[0].at.toISOString(), start.toISOString(), "confirm at enrollment");
  // reminder at call - 24h = 2026-05-26T04:30Z, NOT start+24h (the old bug)
  assert.equal(r.sends[1].at.toISOString(), "2026-05-26T04:30:00.000Z");
  assert.notEqual(r.sends[1].at.toISOString(), "2026-05-25T07:00:00.000Z");
});

test("reminder: window already passed → clamps to now, never negative", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("w", "wait", { wait: { mode: "before_event", event: "booking", hours: 24 } }), N("rem", "send")],
    [E("t", "w"), E("w", "rem")],
  );
  const start = iso("2026-05-25T00:00:00Z");
  const call = iso("2026-05-25T02:00:00Z"); // only 2h away, less than the 24h lead
  const r = simulate(g, { start, startNodeId: "t", eventTime: () => call });
  assert.equal(r.sends[0].at.toISOString(), start.toISOString(), "sends now, not in the past");
});

// ──────────────────────────────────────────────────────────────────────────
// after_previous delay
// ──────────────────────────────────────────────────────────────────────────
test("wait: after_previous schedules relative to now", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("s1", "send"), N("w", "wait", { wait: { mode: "after_previous", hours: 24 } }), N("s2", "send")],
    [E("t", "s1"), E("s1", "w"), E("w", "s2")],
  );
  const start = iso("2026-05-25T00:00:00Z");
  const r = simulate(g, { start, startNodeId: "t" });
  assert.equal(r.sends[0].at.toISOString(), start.toISOString());
  assert.equal(r.sends[1].at.toISOString(), "2026-05-26T00:00:00.000Z");
});

// ──────────────────────────────────────────────────────────────────────────
// Conditions after a wait are evaluated at the RESUMED time, not up front.
// ──────────────────────────────────────────────────────────────────────────
test("condition after wait is evaluated at fire time", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("w", "wait", { wait: { mode: "after_previous", hours: 24 } }),
     N("c", "condition", { condition: { check: "booked" } }), N("yes", "send"), N("no", "send")],
    [E("t", "w"), E("w", "c"), E("c", "yes", "yes"), E("c", "no", "no")],
  );
  const start = iso("2026-05-25T00:00:00Z");
  // contact books at +12h, i.e. before the condition runs at +24h
  const bookedAt = iso("2026-05-25T12:00:00Z");
  const r = simulate(g, {
    start, startNodeId: "t",
    evaluateCondition: (_s, now) => now.getTime() >= bookedAt.getTime(),
  });
  assert.deepEqual(sendIds(r), ["yes"], "condition true because evaluated at +24h, after booking");
});

// ──────────────────────────────────────────────────────────────────────────
// Missing-event policy + loop + unmatched + stop
// ──────────────────────────────────────────────────────────────────────────
test("missing event, skip policy: skips the wait and proceeds now", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("w", "wait", { wait: { mode: "before_event", event: "booking", hours: 24, missingPolicy: "skip" } }), N("s", "send")],
    [E("t", "w"), E("w", "s")],
  );
  const start = iso("2026-05-25T00:00:00Z");
  const r = simulate(g, { start, startNodeId: "t", eventTime: () => null });
  assert.deepEqual(sendIds(r), ["s"]);
  assert.equal(r.sends[0].at.toISOString(), start.toISOString());
});

test("loop: zero-delay cycle terminates with loop_detected", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("c1", "condition", { condition: { check: "x" } }), N("c2", "condition", { condition: { check: "y" } })],
    [E("t", "c1"), E("c1", "c2", "yes"), E("c2", "c1", "yes")],
  );
  const r = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => true });
  assert.equal(r.terminate, "loop_detected");
});

test("condition with no edge on taken branch terminates explicitly (no bleed)", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("c", "condition", { condition: { check: "x" } }), N("yes", "send"), N("other", "send")],
    [E("t", "c"), E("c", "yes", "yes")], // no "no" edge
  );
  const r = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t", evaluateCondition: () => false });
  assert.deepEqual(sendIds(r), []);
  assert.equal(r.terminate, "condition_unmatched");
});

test("stop node terminates the run", () => {
  const g = buildGraph(
    [N("t", "trigger"), N("s", "send"), N("stop", "stop"), N("after", "send")],
    [E("t", "s"), E("s", "stop"), E("stop", "after")],
  );
  const r = simulate(g, { start: iso("2026-05-25T00:00:00Z"), startNodeId: "t" });
  assert.deepEqual(sendIds(r), ["s"]);
  assert.equal(r.terminate, "stop");
});
