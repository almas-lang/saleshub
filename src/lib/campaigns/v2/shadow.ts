/**
 * Shadow-mode orchestrator.
 *
 * Walks active legacy enrollments and asks the v2 engine "what would you do
 * right now?" — without writing anything to the outbox. Each prediction lands
 * in journey_event_log as a `shadow_plan` event alongside the legacy cursor's
 * actual state, so the diff between "what legacy is doing" and "what v2 would
 * do" is a single SELECT after a few daily runs.
 *
 * Lazy-imports journey_edges if a campaign was never re-saved since v2 landed,
 * so shadow works on the existing live data without manual backfill.
 *
 * Never enqueues sends. Never mutates enrollments. Safe to run against prod.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildJourneyEdges } from "./import.ts";
import { processRun, loadGraph } from "./worker.ts";
import { isDivergent } from "./shadow-diff.ts";
export { isDivergent } from "./shadow-diff.ts";

// New v2 tables aren't in the generated Supabase types yet; mirror worker.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const BATCH_LIMIT = 200;

interface ShadowCampaignSummary {
  campaignId: string;
  imported: boolean;
  enrollments: number;
  divergent: number;
  errors: number;
}

export interface ShadowResult {
  campaigns: ShadowCampaignSummary[];
  totalEnrollments: number;
  totalDivergent: number;
  totalErrors: number;
}

/**
 * If a legacy campaign has no journey_edges yet (e.g. last saved before v2
 * landed), build them from flow_data on the fly. Returns true if rows were
 * inserted. Non-fatal — a campaign without flow_data is simply skipped by the
 * caller.
 */
async function ensureEdges(campaignId: string): Promise<{ imported: boolean; usable: boolean }> {
  const { data: existing } = await sb.from("journey_edges").select("id").eq("campaign_id", campaignId).limit(1);
  if (existing?.length) return { imported: false, usable: true };

  const { data: camp } = await sb.from("unified_campaigns").select("flow_data").eq("id", campaignId).maybeSingle();
  const flow = camp?.flow_data as { nodes?: unknown[]; edges?: unknown[] } | null;
  if (!flow?.nodes?.length) return { imported: false, usable: false };

  const { data: steps } = await sb.from("unified_steps").select("id, order").eq("campaign_id", campaignId);
  if (!steps?.length) return { imported: false, usable: false };

  const imp = buildJourneyEdges(flow as { nodes: never[]; edges: never[] }, steps, campaignId, "unified", { missingPolicy: "skip" });
  if (!imp.edgeRows.length) return { imported: false, usable: false };
  await sb.from("journey_edges").insert(imp.edgeRows);
  return { imported: true, usable: true };
}

interface LegacyRun {
  id: string;
  contact_id: string;
  campaign_id: string;
  campaign_type: string;
  current_step_id: string | null;
  current_step_order: number | null;
  next_send_at: string | null;
  status: string;
}

/**
 * Shadow every active legacy enrollment. Groups by campaign so each graph
 * loads once. Writes one `shadow_plan` event per enrollment plus a roll-up
 * `shadow_run_summary` per campaign.
 */
export async function runShadow(opts: { now?: Date; limit?: number } = {}): Promise<ShadowResult> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const limit = opts.limit ?? BATCH_LIMIT;

  // 1. Active legacy enrollments whose campaign is also active. Order by
  //    campaign so the per-campaign graph cache amortizes cleanly.
  const { data: rawRuns } = await sb.from("drip_enrollments")
    .select("id, contact_id, campaign_id, campaign_type, current_step_id, current_step_order, next_send_at, status, engine, unified_campaigns!inner(status, engine)")
    .eq("engine", "legacy")
    .eq("status", "active")
    .eq("unified_campaigns.status", "active")
    .eq("unified_campaigns.engine", "legacy")
    .order("campaign_id", { ascending: true })
    .limit(limit);

  const runs = (rawRuns ?? []) as LegacyRun[];
  if (!runs.length) {
    return { campaigns: [], totalEnrollments: 0, totalDivergent: 0, totalErrors: 0 };
  }

  // 2. Group by campaign.
  const byCampaign = new Map<string, LegacyRun[]>();
  for (const r of runs) {
    if (!byCampaign.has(r.campaign_id)) byCampaign.set(r.campaign_id, []);
    byCampaign.get(r.campaign_id)!.push(r);
  }

  const result: ShadowResult = { campaigns: [], totalEnrollments: 0, totalDivergent: 0, totalErrors: 0 };

  for (const [campaignId, campRuns] of byCampaign) {
    const summary: ShadowCampaignSummary = { campaignId, imported: false, enrollments: 0, divergent: 0, errors: 0 };
    try {
      const edges = await ensureEdges(campaignId);
      summary.imported = edges.imported;
      if (!edges.usable) {
        // Can't shadow without a graph; record once at the campaign level.
        await sb.from("journey_event_log").insert([{
          campaign_id: campaignId, campaign_type: "unified", type: "shadow_skipped",
          detail: { reason: "no_graph", enrollments: campRuns.length, at: nowIso },
        }]);
        summary.errors = campRuns.length;
        result.campaigns.push(summary);
        result.totalErrors += campRuns.length;
        continue;
      }

      const loaded = await loadGraph(campaignId);
      if (!loaded) {
        summary.errors = campRuns.length;
        result.campaigns.push(summary);
        result.totalErrors += campRuns.length;
        continue;
      }

      const events: Array<Record<string, unknown>> = [];
      for (const run of campRuns) {
        try {
          const plan = await processRun(run as never, loaded.graph, now, { dryRun: true });
          const divergent = isDivergent(plan, run, nowMs);
          if (divergent) summary.divergent++;
          summary.enrollments++;
          events.push({
            run_id: run.id,
            contact_id: run.contact_id,
            campaign_id: run.campaign_id,
            campaign_type: run.campaign_type,
            node_id: plan.park?.stepId ?? null,
            type: "shadow_plan",
            detail: {
              at: nowIso,
              predicted: { sends: plan.sends, park: plan.park, terminate: plan.terminate },
              legacy: { current_step_id: run.current_step_id, next_send_at: run.next_send_at },
              divergent,
            },
          });
        } catch (err) {
          summary.errors++;
          events.push({
            run_id: run.id,
            contact_id: run.contact_id,
            campaign_id: run.campaign_id,
            campaign_type: run.campaign_type,
            type: "shadow_error",
            detail: { at: nowIso, message: err instanceof Error ? err.message : String(err) },
          });
        }
      }

      if (events.length) await sb.from("journey_event_log").insert(events);
      result.totalEnrollments += summary.enrollments;
      result.totalDivergent += summary.divergent;
      result.totalErrors += summary.errors;
      result.campaigns.push(summary);
    } catch (err) {
      // Defensive: never let one bad campaign break the whole shadow run.
      summary.errors = campRuns.length;
      await sb.from("journey_event_log").insert([{
        campaign_id: campaignId, campaign_type: "unified", type: "shadow_error",
        detail: { at: nowIso, message: err instanceof Error ? err.message : String(err), scope: "campaign" },
      }]);
      result.totalErrors += campRuns.length;
      result.campaigns.push(summary);
    }
  }

  return result;
}
