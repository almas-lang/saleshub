/**
 * Deterministic simulation harness for the v2 engine.
 *
 * Replays a whole journey against a virtual clock: it calls runTick, records the
 * sends with the virtual time they fired at, jumps the clock forward to each
 * "park" time, and repeats until the run terminates. Condition results and event
 * times are supplied as functions of the current virtual time, so you can model
 * "the contact books at T+12h" or "the call is on Wednesday" and assert the exact
 * ordered set of sends and their fire times. Every edge case becomes a test.
 */

import { runTick, type Graph, type ConditionSpec } from "./engine.ts";

export interface Scenario {
  start: Date;
  startNodeId: string;
  evaluateCondition?: (spec: ConditionSpec, now: Date) => boolean;
  eventTime?: (event: string, now: Date) => Date | null;
  maxSteps?: number;
}

export interface SimSend {
  nodeId: string;
  channel?: string;
  at: Date;
}

export interface SimResult {
  sends: SimSend[];
  terminate: string | null;
  events: { at: Date; type: string; nodeId?: string; detail?: Record<string, unknown> }[];
}

export function simulate(graph: Graph, scenario: Scenario): SimResult {
  let now = scenario.start;
  let cursor = scenario.startNodeId;
  const sends: SimSend[] = [];
  const events: SimResult["events"] = [];
  const max = scenario.maxSteps ?? 1000;

  for (let i = 0; i < max; i++) {
    const tickNow = now;
    const r = runTick(graph, cursor, {
      now: tickNow,
      evaluateCondition: (s) => (scenario.evaluateCondition ? scenario.evaluateCondition(s, tickNow) : false),
      eventTime: (e) => (scenario.eventTime ? scenario.eventTime(e, tickNow) : null),
    });
    for (const s of r.sends) sends.push({ ...s, at: tickNow });
    for (const e of r.events) events.push({ at: tickNow, ...e });

    if (r.terminate) return { sends, terminate: r.terminate, events };
    if (r.park) {
      now = r.park.at.getTime() > now.getTime() ? r.park.at : new Date(now.getTime() + 1000);
      cursor = r.park.nodeId;
      continue;
    }
    return { sends, terminate: "no_progress", events };
  }
  return { sends, terminate: "sim_max_steps", events };
}
