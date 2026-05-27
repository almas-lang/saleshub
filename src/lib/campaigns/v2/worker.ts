/**
 * v2 worker — runs due journeys through the engine.
 *
 * Per tick: claim due runs (engine=v2), load the graph from journey_edges +
 * unified_steps, runTick, write the audit log, enqueue sends to the outbox
 * (exactly-once via idempotency_key), and park/complete the cursor. Sending
 * itself is the outbox drainer's job (see outbox.ts) — routing never blocks on a
 * network call.
 *
 * `dryRun` computes and reports without writing or enqueuing — used to verify a
 * campaign against real data safely.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { evaluateCondition } from "@/lib/campaigns/condition-evaluators";
import { buildGraph, runTick, type JourneyNode, type Graph, type LogEvent } from "./engine.ts";
import type { WaitSpec } from "./scheduler.ts";

// New columns/tables (journey_edges, claim/retry cols) aren't in the generated
// Supabase types yet; cast like the legacy processor does.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const BATCH_LIMIT = 50;
const CLAIM_WINDOW_MS = 120_000;

interface StepRow {
  id: string;
  order: number;
  step_type: string | null;
  channel: string | null;
  delay_hours: number | null;
  delay_mode: string | null;
  condition: { check: string; value?: string } | null;
}

interface RunRow {
  id: string;
  contact_id: string;
  campaign_id: string;
  campaign_type: string;
  current_step_id: string | null;
  current_step_order: number | null;
  status: string;
}

export interface RunPlan {
  runId: string;
  sends: { stepId: string; channel?: string }[];
  park: { stepId: string; at: string } | null;
  terminate: string | null;
}

function mkDelay(step: StepRow): WaitSpec | undefined {
  const h = step.delay_hours ?? 0;
  if (step.delay_mode === "before_booking") return { mode: "before_event", event: "booking", hours: h, missingPolicy: "skip" };
  if (h > 0) return { mode: "after_previous", hours: h };
  return undefined;
}

function stepToNode(step: StepRow): JourneyNode {
  if (step.step_type === "condition") {
    return { id: step.id, type: "condition", condition: { check: step.condition?.check ?? "", value: step.condition?.value }, delay: mkDelay(step) };
  }
  return { id: step.id, type: "send", channel: (step.channel as "email" | "whatsapp") ?? "whatsapp", delay: mkDelay(step) };
}

/** Build the engine graph for a campaign from unified_steps (nodes) + journey_edges. */
export async function loadGraph(campaignId: string): Promise<{ graph: Graph; stepById: Map<string, StepRow> } | null> {
  const { data: steps } = await sb
    .from("unified_steps")
    .select("id, order, step_type, channel, delay_hours, delay_mode, condition")
    .eq("campaign_id", campaignId);
  if (!steps?.length) return null;
  const { data: edges } = await sb
    .from("journey_edges")
    .select("from_node, to_node, branch")
    .eq("campaign_id", campaignId);

  const stepById = new Map<string, StepRow>((steps as StepRow[]).map((s) => [s.id, s]));
  const nodes = (steps as StepRow[]).map(stepToNode);
  const graph = buildGraph(
    nodes,
    (edges ?? []).map((e: { from_node: string; to_node: string; branch: string }) => ({ from: e.from_node, to: e.to_node, branch: e.branch as "default" | "yes" | "no" })),
  );
  return { graph, stepById };
}

/** Next upcoming confirmed booking time for a contact (maybeSingle — never throws/falls back). */
async function bookingTime(contactId: string, now: Date): Promise<Date | null> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("starts_at")
    .eq("contact_id", contactId)
    .eq("status", "confirmed")
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.starts_at ? new Date(data.starts_at) : null;
}

async function writeEvents(run: RunRow, events: LogEvent[]) {
  if (!events.length) return;
  await sb.from("journey_event_log").insert(
    events.map((e) => ({
      run_id: run.id,
      contact_id: run.contact_id,
      campaign_id: run.campaign_id,
      campaign_type: run.campaign_type,
      node_id: e.nodeId ?? null,
      type: e.type,
      detail: e.detail ?? null,
    })),
  );
}

/**
 * Enqueue a send to the outbox, exactly-once via idempotency_key = run:step.
 *
 * We use plain insert + catch the unique-violation rather than `.upsert({onConflict})`.
 * Reason: the migration declared `idempotency_key` as a PARTIAL unique index
 * (`WHERE idempotency_key IS NOT NULL`), and supabase-js's onConflict path doesn't
 * reliably match partial indexes — it silently dropped every insert without throwing,
 * so v2 produced zero send rows in prod despite the engine logging `message_enqueued`.
 * Plain insert + duplicate-key check is the boring, explicit version.
 */
async function enqueueSend(run: RunRow, stepId: string, channel?: string) {
  const table = channel === "email" ? "email_sends" : "wa_sends";
  const { error } = await sb.from(table).insert({
    contact_id: run.contact_id,
    campaign_id: run.campaign_id,
    step_id: stepId,
    status: "queued",
    idempotency_key: `${run.id}:${stepId}`,
  });
  if (error) {
    // Postgres unique-violation code = 23505. Idempotency hit → already enqueued, fine.
    // Anything else is a real failure we need to know about.
    if (error.code !== "23505") {
      const { logger } = await import("@/lib/logger");
      await logger.error("journey-worker", `enqueueSend ${channel} failed: ${error.message}`, { table, run_id: run.id, step_id: stepId, code: error.code });
    }
  }
}

export async function processRun(run: RunRow, graph: Graph, now: Date, opts: { dryRun?: boolean } = {}): Promise<RunPlan> {
  const cursor = run.current_step_id ?? (graph.nodes.size ? [...graph.nodes.keys()][0] : null);
  if (!cursor) return { runId: run.id, sends: [], park: null, terminate: "no_cursor" };

  // runTick is sync, but conditions + booking lookups are async DB calls. Pre-resolve
  // them (distinct condition checks, and the next booking time) before the tick.
  const bAt = await bookingTime(run.contact_id, now);
  const condCache = new Map<string, boolean>();
  for (const node of graph.nodes.values()) {
    if (node.type === "condition" && node.condition) {
      const key = `${node.condition.check}:${node.condition.value ?? ""}`;
      if (!condCache.has(key)) {
        condCache.set(key, await evaluateCondition(node.condition.check, run.contact_id, run.campaign_id, node.condition.value));
      }
    }
  }

  const result = runTick(graph, cursor, {
    now,
    evaluateCondition: (spec) => condCache.get(`${spec.check}:${spec.value ?? ""}`) ?? false,
    eventTime: (event) => (event === "booking" ? bAt : null),
  });

  const plan: RunPlan = {
    runId: run.id,
    sends: result.sends.map((s) => ({ stepId: s.nodeId, channel: s.channel })),
    park: result.park ? { stepId: result.park.nodeId, at: result.park.at.toISOString() } : null,
    terminate: result.terminate,
  };

  if (opts.dryRun) return plan;

  await writeEvents(run, result.events);
  for (const s of result.sends) await enqueueSend(run, s.nodeId, s.channel);

  if (result.park) {
    await sb.from("drip_enrollments").update({
      current_step_id: result.park.nodeId,
      next_send_at: result.park.at.toISOString(),
      claim_token: null,
      claimed_until: null,
    }).eq("id", run.id);
  } else {
    await sb.from("drip_enrollments").update({
      status: "completed",
      completed_at: now.toISOString(),
      stopped_reason: result.terminate,
      claim_token: null,
      claimed_until: null,
    }).eq("id", run.id);
  }
  return plan;
}

/**
 * Process all due v2 runs. `onlyIds` bypasses the claim/status filter for dry-run
 * verification against specific enrollments.
 */
export async function processDueRuns(opts: { now?: Date; limit?: number; dryRun?: boolean; onlyIds?: string[] } = {}): Promise<RunPlan[]> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? BATCH_LIMIT;

  let runs: RunRow[];
  if (opts.onlyIds?.length) {
    const { data } = await sb.from("drip_enrollments")
      .select("id, contact_id, campaign_id, campaign_type, current_step_id, current_step_order, status")
      .in("id", opts.onlyIds);
    runs = (data ?? []) as RunRow[];
  } else {
    const { data: due } = await sb.from("drip_enrollments")
      .select("id, contact_id, campaign_id, campaign_type, current_step_id, current_step_order, status")
      .eq("engine", "v2").eq("status", "active").lte("next_send_at", now.toISOString())
      .order("next_send_at", { ascending: true }).limit(limit);
    runs = (due ?? []) as RunRow[];
    // claim: bump next_send_at out by the claim window so a concurrent run skips them
    if (!opts.dryRun && runs.length) {
      await sb.from("drip_enrollments")
        .update({ next_send_at: new Date(now.getTime() + CLAIM_WINDOW_MS).toISOString() })
        .in("id", runs.map((r) => r.id)).eq("status", "active");
    }
  }

  // group by campaign to load each graph once
  const plans: RunPlan[] = [];
  const graphCache = new Map<string, Graph | null>();
  for (const run of runs) {
    // campaign must still be active
    const { data: camp } = await sb.from("unified_campaigns").select("status").eq("id", run.campaign_id).maybeSingle();
    if (!opts.onlyIds && camp?.status !== "active") {
      if (!opts.dryRun) await sb.from("drip_enrollments").update({ status: "paused" }).eq("id", run.id);
      continue;
    }
    if (!graphCache.has(run.campaign_id)) {
      const g = await loadGraph(run.campaign_id);
      graphCache.set(run.campaign_id, g?.graph ?? null);
    }
    const graph = graphCache.get(run.campaign_id);
    if (!graph) { plans.push({ runId: run.id, sends: [], park: null, terminate: "no_graph" }); continue; }
    plans.push(await processRun(run, graph, now, { dryRun: opts.dryRun }));
  }
  return plans;
}
