import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCampaignSchema } from "@/lib/validations";
import type { WACampaignWithStats, WACampaign, WASendStatus, AudienceFilter } from "@/types/campaigns";
import { enrollAudience } from "@/lib/campaigns/wa-audience";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const ALLOWED_PER_PAGE = [10, 25, 50, 100];
  const parsedPerPage = parseInt(params.get("per_page") ?? "25");
  const perPage = ALLOWED_PER_PAGE.includes(parsedPerPage) ? parsedPerPage : 25;
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const type = params.get("type") ?? "";
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Build campaigns query
  let query = supabase
    .from("wa_campaigns")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("name", `%${search}%`);

  const ascending = order === "asc";
  query = query.order(sort, { ascending }).range(from, to);

  const { data: campaigns, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const campaignList = (campaigns ?? []) as WACampaign[];

  // Fetch step counts + send stats for the returned campaigns
  const campaignIds = campaignList.map((c) => c.id);
  let campaignsWithStats: WACampaignWithStats[] = campaignList.map((c) => ({
    ...c,
    step_count: 0,
    recipient_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
  }));

  if (campaignIds.length > 0) {
    // Fetch step counts per campaign
    const { data: steps } = await supabase
      .from("wa_steps")
      .select("campaign_id")
      .in("campaign_id", campaignIds);

    const stepCountMap: Record<string, number> = {};
    if (steps) {
      for (const s of steps) {
        stepCountMap[s.campaign_id] = (stepCountMap[s.campaign_id] ?? 0) + 1;
      }
    }

    // Fetch send status counts per campaign
    const { data: sends } = await supabase
      .from("wa_sends")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds);

    const sendStatsMap: Record<string, {
      recipient_count: number;
      sent_count: number;
      delivered_count: number;
      read_count: number;
      failed_count: number;
    }> = {};

    if (sends) {
      for (const s of sends) {
        const cid = s.campaign_id;
        if (!cid) continue;
        if (!sendStatsMap[cid]) {
          sendStatsMap[cid] = {
            recipient_count: 0,
            sent_count: 0,
            delivered_count: 0,
            read_count: 0,
            failed_count: 0,
          };
        }
        const stats = sendStatsMap[cid];
        stats.recipient_count++;
        const status = s.status as WASendStatus;
        if (status === "sent" || status === "delivered" || status === "read") {
          stats.sent_count++;
        }
        if (status === "delivered" || status === "read") {
          stats.delivered_count++;
        }
        if (status === "read") {
          stats.read_count++;
        }
        if (status === "failed") {
          stats.failed_count++;
        }
      }
    }

    // Merge stats into campaigns
    campaignsWithStats = campaignList.map((c) => ({
      ...c,
      step_count: stepCountMap[c.id] ?? 0,
      recipient_count: sendStatsMap[c.id]?.recipient_count ?? 0,
      sent_count: sendStatsMap[c.id]?.sent_count ?? 0,
      delivered_count: sendStatsMap[c.id]?.delivered_count ?? 0,
      read_count: sendStatsMap[c.id]?.read_count ?? 0,
      failed_count: sendStatsMap[c.id]?.failed_count ?? 0,
    }));
  }

  return NextResponse.json({
    data: campaignsWithStats,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, type, audience_filter, steps, activate, flow_data, branching_edges } = parsed.data;

  // 1. Insert campaign as draft
  const { data: campaign, error: campaignError } = await supabase
    .from("wa_campaigns")
    .insert({
      name,
      type,
      status: "draft" as const,
      audience_filter: audience_filter ?? null,
      flow_data: flow_data ?? null,
    })
    .select()
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  // 2. Pass 1: Insert all step rows (without branching pointers)
  const stepRows = steps.map((s) => ({
    campaign_id: campaign.id,
    order: s.order,
    step_type: s.step_type ?? "send",
    wa_template_name: s.wa_template_name,
    template_id: null, // wa_templates mirror not synced yet; store name only
    delay_hours: s.delay_hours,
    wa_template_params: s.wa_template_params,
    condition: s.condition ?? null,
  }));

  let insertedSteps: { id: string; order: number }[] = [];

  if (stepRows.length > 0) {
    const { data, error: stepsError } = await supabase
      .from("wa_steps")
      .insert(stepRows)
      .select("id, order");

    if (stepsError || !data) {
      await supabase.from("wa_campaigns").delete().eq("id", campaign.id);
      return NextResponse.json({ error: stepsError?.message ?? "Failed to insert steps" }, { status: 500 });
    }
    insertedSteps = data;
  }

  // 3. Pass 2: Set branching pointers if edges provided
  if (branching_edges?.length && insertedSteps.length > 0) {
    // Map node_id → DB step UUID
    const nodeToDbId = new Map<string, string>();
    for (let i = 0; i < steps.length; i++) {
      const nodeId = steps[i].node_id;
      const dbStep = insertedSteps[i];
      if (nodeId && dbStep) {
        nodeToDbId.set(nodeId, dbStep.id);
      }
    }

    // Apply branching edges
    for (const edge of branching_edges) {
      const sourceDbId = nodeToDbId.get(edge.source_node_id);
      const targetDbId = nodeToDbId.get(edge.target_node_id);
      if (!sourceDbId || !targetDbId) continue;

      const column = edge.branch === "yes" ? "next_step_id_yes" : "next_step_id_no";
      await supabase
        .from("wa_steps")
        .update({ [column]: targetDbId })
        .eq("id", sourceDbId);
    }
  }

  // 4. Activate if requested
  if (activate) {
    await supabase
      .from("wa_campaigns")
      .update({ status: "active" as const })
      .eq("id", campaign.id);
  }

  return NextResponse.json(campaign, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body.status === "string") {
    const validStatuses = ["draft", "active", "paused", "completed"];
    if (validStatuses.includes(body.status)) {
      update.status = body.status;
    }
  }
  if (body.audience_filter !== undefined) {
    update.audience_filter = body.audience_filter;
  }
  if (body.flow_data !== undefined) {
    update.flow_data = body.flow_data;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Fetch current campaign to detect status transition
  const { data: existing } = await supabase
    .from("wa_campaigns")
    .select("status, type, audience_filter")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("wa_campaigns")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-enroll audience when a drip campaign is activated
  if (
    update.status === "active" &&
    existing &&
    existing.status !== "active" &&
    existing.type === "drip"
  ) {
    const af = existing.audience_filter as AudienceFilter | null;
    const enrollmentType = af?.enrollment_type ?? "existing";
    // Only bulk-enroll for "existing" or "both" — skip for "new_leads" (auto-enrolled via auto-enroll.ts)
    if (enrollmentType === "existing" || enrollmentType === "both") {
      const enrolled = await enrollAudience(id, af);
      return NextResponse.json({ ...data, enrolled });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 });
  }

  // Delete related sends and steps first (cascade may be set, but be explicit)
  await supabase.from("wa_sends").delete().eq("campaign_id", id);
  await supabase.from("wa_steps").delete().eq("campaign_id", id);

  const { error } = await supabase
    .from("wa_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
