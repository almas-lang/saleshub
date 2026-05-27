import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createUnifiedCampaignSchema } from "@/lib/validations";
import { autoEnrollIntoDrips } from "@/lib/contacts/auto-enroll";
import { buildNodeToDbIdMap } from "@/lib/campaigns/journey-engine";
import { validateCampaignForActivation } from "@/lib/campaigns/campaign-validation";
import { buildJourneyEdges } from "@/lib/campaigns/v2/import";

/**
 * Persist the v2 journey graph (journey_edges) for a campaign. Additive and
 * idempotent — keeps the v2 graph in sync on every save so cutover is just an
 * engine flag flip. Never throws into the save flow.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistJourneyEdges(supabase: any, campaignId: string, flowData: unknown, insertedSteps: { id: string; order: number }[]) {
  try {
    const flow = (flowData as { nodes?: unknown[]; edges?: unknown[] }) ?? { nodes: [], edges: [] };
    if (!flow.nodes?.length || !insertedSteps.length) return;
    const imp = buildJourneyEdges(flow as { nodes: never[]; edges: never[] }, insertedSteps, campaignId, "unified", { missingPolicy: "skip" });
    await supabase.from("journey_edges").delete().eq("campaign_id", campaignId);
    if (imp.edgeRows.length) await supabase.from("journey_edges").insert(imp.edgeRows);
  } catch (e) {
    console.error("[unified] persistJourneyEdges failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}

export async function GET(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") ?? "1");
  const perPage = parseInt(searchParams.get("per_page") ?? "20");
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("unified_campaigns")
    .select("*", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("name", `%${search}%`);

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    campaigns: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  });
}

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Duplicate shortcut: copy steps from an existing campaign ──
  const rawBody = body as Record<string, unknown>;
  if (rawBody.duplicate_of && typeof rawBody.duplicate_of === "string") {
    const sourceId = rawBody.duplicate_of;
    const { data: source } = await supabase
      .from("unified_campaigns")
      .select("*")
      .eq("id", sourceId)
      .single();

    if (!source) {
      return NextResponse.json({ error: "Source campaign not found" }, { status: 404 });
    }

    const { data: sourceSteps } = await supabase
      .from("unified_steps")
      .select("*")
      .eq("campaign_id", sourceId)
      .order("order", { ascending: true });

    // Create the duplicate campaign
    const { data: newCampaign, error: campErr } = await supabase
      .from("unified_campaigns")
      .insert({
        name: rawBody.name ?? `${source.name} (copy)`,
        type: source.type,
        status: "draft",
        trigger_event: source.trigger_event ?? "lead_created",
        audience_filter: source.audience_filter,
        stop_condition: source.stop_condition,
        flow_data: source.flow_data,
      })
      .select()
      .single();

    if (campErr || !newCampaign) {
      return NextResponse.json({ error: campErr?.message ?? "Failed to create campaign" }, { status: 500 });
    }

    // Copy steps
    if (sourceSteps?.length) {
      const newStepRows = sourceSteps.map((s: Record<string, unknown>) => ({
        campaign_id: newCampaign.id,
        order: s.order,
        step_type: s.step_type ?? "send",
        channel: s.channel,
        delay_hours: s.delay_hours,
        delay_mode: s.delay_mode ?? "after_previous",
        subject: s.subject ?? null,
        body_html: s.body_html ?? null,
        preview_text: s.preview_text ?? null,
        wa_template_name: s.wa_template_name ?? null,
        wa_template_language: s.wa_template_language ?? "en",
        wa_template_params: s.wa_template_params ?? null,
        wa_template_param_names: s.wa_template_param_names ?? null,
        condition: s.condition ?? null,
      }));

      const { data: insertedSteps, error: stepsErr } = await supabase
        .from("unified_steps")
        .insert(newStepRows)
        .select("id, \"order\"");

      if (stepsErr || !insertedSteps) {
        await supabase.from("unified_campaigns").delete().eq("id", newCampaign.id);
        return NextResponse.json({ error: stepsErr?.message ?? "Failed to copy steps" }, { status: 500 });
      }

      // Remap branching pointers (next_step_id_yes / next_step_id_no)
      // Match by order field — insertedSteps may not come back in insertion order
      const newStepsByOrder = new Map<number, string>(
        insertedSteps.map((s: { id: string; order: number }) => [s.order, s.id])
      );
      const oldIdToNewId = new Map<string, string>();
      sourceSteps.forEach((s: Record<string, unknown>) => {
        const newId = newStepsByOrder.get(s.order as number);
        if (s.id && newId) {
          oldIdToNewId.set(s.id as string, newId);
        }
      });

      for (const src of sourceSteps as Record<string, unknown>[]) {
        const newId = oldIdToNewId.get(src.id as string);
        if (!newId) continue;

        const updates: Record<string, string | null> = {};
        if (src.next_step_id_yes && oldIdToNewId.has(src.next_step_id_yes as string)) {
          updates.next_step_id_yes = oldIdToNewId.get(src.next_step_id_yes as string)!;
        }
        if (src.next_step_id_no && oldIdToNewId.has(src.next_step_id_no as string)) {
          updates.next_step_id_no = oldIdToNewId.get(src.next_step_id_no as string)!;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("unified_steps").update(updates).eq("id", newId);
        }
      }

      // Persist the v2 journey graph for the duplicated steps so the new campaign
      // is v2-ready from creation. Mirrors the POST path; idempotent.
      await persistJourneyEdges(
        supabase,
        newCampaign.id,
        source.flow_data,
        insertedSteps as { id: string; order: number }[],
      );
    }

    return NextResponse.json(newCampaign, { status: 201 });
  }

  const parsed = createUnifiedCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, type, audience_filter, steps, activate, flow_data, branching_edges, stop_condition, trigger_event, trigger_stage_id } = parsed.data;

  // Validate before creating anything when activating — a broken journey must not go live.
  let activationWarnings: string[] = [];
  if (activate) {
    const { errors, warnings } = await validateCampaignForActivation({ steps, edges: branching_edges });
    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }
    activationWarnings = warnings;
  }

  // 1. Insert campaign as draft
  const { data: campaign, error: campaignError } = await supabase
    .from("unified_campaigns")
    .insert({
      name,
      type,
      status: "draft" as const,
      trigger_event: trigger_event ?? "lead_created",
      audience_filter: audience_filter ?? null,
      stop_condition: stop_condition ?? null,
      flow_data: flow_data ?? null,
    })
    .select()
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  // 2. Insert steps
  const stepRows = steps.map((s) => ({
    campaign_id: campaign.id,
    order: s.order,
    step_type: s.step_type ?? "send",
    channel: s.channel,
    delay_hours: s.delay_hours,
    delay_mode: s.delay_mode ?? "after_previous",
    // Email fields
    subject: s.subject ?? null,
    body_html: s.body_html ?? null,
    preview_text: s.preview_text ?? null,
    // WhatsApp fields
    wa_template_name: s.wa_template_name ?? null,
    wa_template_language: s.wa_template_language ?? "en",
    wa_template_params: s.wa_template_params ?? null,
    wa_template_param_names: s.wa_template_param_names ?? null,
    // Condition
    condition: s.condition ?? null,
  }));

  let insertedSteps: { id: string; order: number }[] = [];

  if (stepRows.length > 0) {
    const { data, error: stepsError } = await supabase
      .from("unified_steps")
      .insert(stepRows)
      .select("id, order");

    if (stepsError || !data) {
      await supabase.from("unified_campaigns").delete().eq("id", campaign.id);
      return NextResponse.json({ error: stepsError?.message ?? "Failed to insert steps" }, { status: 500 });
    }
    insertedSteps = data;
  }

  // 3. Set branching pointers if edges provided
  if (branching_edges?.length && insertedSteps.length > 0) {
    const nodeIdToStepId = buildNodeToDbIdMap(steps, insertedSteps);

    // Group edges by source+branch to handle parallel sends (e.g., condition yes→email + yes→WA)
    // When multiple targets share the same branch, chain them: first gets the pointer, first→second via next_step_id_no
    const edgeGroups = new Map<string, string[]>(); // key: "sourceDbId:branch" → targetDbIds[]
    for (const edge of branching_edges) {
      const sourceDbId = nodeIdToStepId.get(edge.source_node_id);
      const targetDbId = nodeIdToStepId.get(edge.target_node_id);
      if (!sourceDbId || !targetDbId) continue;
      const key = `${sourceDbId}:${edge.branch}`;
      if (!edgeGroups.has(key)) edgeGroups.set(key, []);
      edgeGroups.get(key)!.push(targetDbId);
    }

    // Track steps whose next_step_id_no has been set by chaining to avoid overwrites
    const chainedSteps = new Set<string>();

    for (const [key, targets] of edgeGroups) {
      const [sourceDbId, branch] = key.split(":");
      const column = branch === "yes" ? "next_step_id_yes" : "next_step_id_no";
      // Point condition to first target
      await supabase.from("unified_steps").update({ [column]: targets[0] }).eq("id", sourceDbId);
      // Chain parallel targets: first→second via next_step_id_no (linear advancement pointer)
      // Skip if the step's next_step_id_no was already set by a previous chain group
      for (let i = 0; i < targets.length - 1; i++) {
        if (!chainedSteps.has(targets[i])) {
          await supabase.from("unified_steps").update({ next_step_id_no: targets[i + 1] }).eq("id", targets[i]);
          chainedSteps.add(targets[i]);
        }
      }
      // Mark the last target in the chain too (its next_step_id_no should not be overwritten by another group)
      if (targets.length > 1) {
        chainedSteps.add(targets[targets.length - 1]);
      }
    }
  }

  // 3b. Persist the v2 journey graph (additive; engine flip happens at cutover)
  await persistJourneyEdges(supabase, campaign.id, flow_data, insertedSteps);

  // 4. Activate if requested
  if (activate) {
    await supabase
      .from("unified_campaigns")
      .update({ status: "active" as const })
      .eq("id", campaign.id);

    if (type === "drip") {
      const enrollmentType = audience_filter?.enrollment_type ?? "new_leads";
      if (enrollmentType === "existing" || enrollmentType === "both") {
        // Enroll existing matching contacts
        let contactQuery = supabaseAdmin
          .from("contacts")
          .select("id")
          .is("deleted_at", null);

        if (audience_filter?.source) contactQuery = contactQuery.eq("source", audience_filter.source);
        if (audience_filter?.funnel_id) contactQuery = contactQuery.eq("funnel_id", audience_filter.funnel_id);
        if (audience_filter?.stage_id) contactQuery = contactQuery.eq("current_stage_id", audience_filter.stage_id);
        if (audience_filter?.assigned_to) contactQuery = contactQuery.eq("assigned_to", audience_filter.assigned_to);
        if (!audience_filter?.include_archived) contactQuery = contactQuery.is("archived_at", null);

        const { data: contacts } = await contactQuery;
        if (contacts?.length) {
          const firstStep = insertedSteps.sort((a, b) => a.order - b.order)[0];
          const enrollments = contacts.map((c) => ({
            contact_id: c.id,
            campaign_id: campaign.id,
            campaign_type: "unified",
            current_step_order: firstStep.order,
            current_step_id: firstStep.id,
            status: "active",
            next_send_at: new Date().toISOString(),
          }));
          await supabaseAdmin.from("drip_enrollments").insert(enrollments);
        }
      }
    }
  }

  return NextResponse.json({
    id: campaign.id,
    status: activate ? "active" : "draft",
    ...(activationWarnings.length ? { warnings: activationWarnings } : {}),
  });
}

export async function PATCH(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });

  const body = await request.json();

  // Fetch current campaign state for status transition logic
  const { data: current } = await supabase.from("unified_campaigns").select("status, audience_filter").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const oldStatus = current.status;
  const newStatus = body.status ?? oldStatus;

  // Conflict detection: if client sends updated_at, verify it matches
  if (body.expected_updated_at) {
    const { data: latest } = await supabase.from("unified_campaigns").select("updated_at").eq("id", id).single();
    if (latest && latest.updated_at !== body.expected_updated_at) {
      return NextResponse.json(
        { error: "This campaign was modified by another session. Please refresh and try again.", code: "CONFLICT" },
        { status: 409 }
      );
    }
  }

  // Block step modifications on active campaigns
  if (oldStatus === "active" && Array.isArray(body.steps) && body.steps.length > 0) {
    return NextResponse.json(
      { error: "Cannot modify steps of an active campaign. Pause it first." },
      { status: 400 }
    );
  }

  // Validate on first activation (draft→active) or when steps are being changed.
  // A plain resume (paused→active with no step changes) skips validation so an
  // operational pause/resume can't be blocked by drift it didn't introduce.
  let activationWarnings: string[] = [];
  const uniStepsChanged = Array.isArray(body.steps) && body.steps.length > 0;
  if (newStatus === "active" && oldStatus !== "active" && (oldStatus === "draft" || uniStepsChanged)) {
    let result;
    if (uniStepsChanged) {
      result = await validateCampaignForActivation({ steps: body.steps, edges: body.branching_edges });
    } else {
      const { data: storedSteps } = await supabase
        .from("unified_steps")
        .select("step_type, channel, condition, wa_template_name, wa_template_language, wa_template_params, next_step_id_yes, next_step_id_no")
        .eq("campaign_id", id);
      result = await validateCampaignForActivation({ steps: storedSteps ?? [] });
    }
    if (result.errors.length) {
      return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
    }
    activationWarnings = result.warnings;
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.trigger_event !== undefined) update.trigger_event = body.trigger_event;
  if (body.audience_filter !== undefined) update.audience_filter = body.audience_filter;
  if (body.stop_condition !== undefined) update.stop_condition = body.stop_condition;
  if (body.flow_data !== undefined) update.flow_data = body.flow_data;
  if (body.status !== undefined) update.status = body.status;

  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from("unified_campaigns").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace steps if provided (only for draft/paused campaigns)
  if (Array.isArray(body.steps) && body.steps.length > 0) {
    // Reset enrollments that reference old step IDs before deleting steps
    await supabaseAdmin
      .from("drip_enrollments")
      .update({ current_step_id: null })
      .eq("campaign_id", id)
      .eq("campaign_type", "unified")
      .in("status", ["active", "paused"]);

    await supabase.from("unified_steps").delete().eq("campaign_id", id);

    const stepRows = (body.steps as Array<Record<string, unknown>>).map((s) => ({
      campaign_id: id,
      order: s.order,
      step_type: s.step_type ?? "send",
      channel: s.channel,
      delay_hours: s.delay_hours,
      delay_mode: (s.delay_mode as string) ?? "after_previous",
      subject: s.subject ?? null,
      body_html: s.body_html ?? null,
      preview_text: s.preview_text ?? null,
      wa_template_name: s.wa_template_name ?? null,
      wa_template_language: s.wa_template_language ?? "en",
      wa_template_params: s.wa_template_params ?? null,
      wa_template_param_names: s.wa_template_param_names ?? null,
      condition: s.condition ?? null,
    }));

    const { data: insertedSteps } = await supabase.from("unified_steps").insert(stepRows).select("id, order");

    // Set branching pointers (same logic as POST)
    const branchingEdges = body.branching_edges as Array<{ source_node_id: string; target_node_id: string; branch: string | null }> | undefined;
    const steps = body.steps as Array<Record<string, unknown>>;
    if (branchingEdges?.length && insertedSteps?.length) {
      const nodeIdToStepId = buildNodeToDbIdMap(
        steps as { node_id?: string | null; order?: number | null }[],
        insertedSteps,
      );

      // Group edges by source+branch to handle parallel sends (same as POST)
      const edgeGroups = new Map<string, string[]>();
      for (const edge of branchingEdges) {
        const sourceDbId = nodeIdToStepId.get(edge.source_node_id);
        const targetDbId = nodeIdToStepId.get(edge.target_node_id);
        if (!sourceDbId || !targetDbId) continue;
        const key = `${sourceDbId}:${edge.branch}`;
        if (!edgeGroups.has(key)) edgeGroups.set(key, []);
        edgeGroups.get(key)!.push(targetDbId);
      }

      const chainedSteps = new Set<string>();

      for (const [key, targets] of edgeGroups) {
        const [sourceDbId, branch] = key.split(":");
        const column = branch === "yes" ? "next_step_id_yes" : "next_step_id_no";
        await supabase.from("unified_steps").update({ [column]: targets[0] }).eq("id", sourceDbId);
        for (let i = 0; i < targets.length - 1; i++) {
          if (!chainedSteps.has(targets[i])) {
            await supabase.from("unified_steps").update({ next_step_id_no: targets[i + 1] }).eq("id", targets[i]);
            chainedSteps.add(targets[i]);
          }
        }
        if (targets.length > 1) {
          chainedSteps.add(targets[targets.length - 1]);
        }
      }
    }

    // persist the v2 journey graph for the replaced steps
    await persistJourneyEdges(supabase, id, body.flow_data ?? null, (insertedSteps ?? []) as { id: string; order: number }[]);
  }

  // ── Status transition side-effects ──

  // Activating (draft→active or paused→active)
  if (newStatus === "active" && oldStatus !== "active") {
    if (oldStatus === "paused") {
      // Resume: reactivate paused enrollments
      await supabaseAdmin
        .from("drip_enrollments")
        .update({ status: "active", next_send_at: new Date().toISOString() })
        .eq("campaign_id", id)
        .eq("campaign_type", "unified")
        .eq("status", "paused");
    } else if (oldStatus === "draft") {
      // First activation: enroll existing matching contacts
      const audienceFilter = body.audience_filter ?? current.audience_filter;
      const enrollmentType = audienceFilter?.enrollment_type ?? "new_leads";
      if (enrollmentType === "existing" || enrollmentType === "both") {
        const { data: steps } = await supabaseAdmin
          .from("unified_steps")
          .select("id, order")
          .eq("campaign_id", id)
          .order("order", { ascending: true })
          .limit(1);

        const firstStep = steps?.[0];
        if (firstStep) {
          let contactQuery = supabaseAdmin
            .from("contacts")
            .select("id")
            .is("deleted_at", null);

          if (audienceFilter?.source) contactQuery = contactQuery.eq("source", audienceFilter.source);
          if (audienceFilter?.funnel_id) contactQuery = contactQuery.eq("funnel_id", audienceFilter.funnel_id);
          if (audienceFilter?.stage_id) contactQuery = contactQuery.eq("current_stage_id", audienceFilter.stage_id);
          if (audienceFilter?.assigned_to) contactQuery = contactQuery.eq("assigned_to", audienceFilter.assigned_to);
          if (!audienceFilter?.include_archived) contactQuery = contactQuery.is("archived_at", null);

          const { data: contacts } = await contactQuery;
          if (contacts?.length) {
            // Check for existing enrollments to avoid duplicates
            const { data: existing } = await supabaseAdmin
              .from("drip_enrollments")
              .select("contact_id")
              .eq("campaign_id", id)
              .eq("campaign_type", "unified");
            const enrolled = new Set((existing ?? []).map((e) => e.contact_id));

            const enrollments = contacts
              .filter((c) => !enrolled.has(c.id))
              .map((c) => ({
                contact_id: c.id,
                campaign_id: id,
                campaign_type: "unified",
                current_step_order: firstStep.order,
                current_step_id: firstStep.id,
                status: "active",
                next_send_at: new Date().toISOString(),
              }));
            if (enrollments.length > 0) {
              await supabaseAdmin.from("drip_enrollments").insert(enrollments);
            }
          }
        }
      }
    }
  }

  // Pausing (active→paused): pause all active enrollments
  if (newStatus === "paused" && oldStatus === "active") {
    await supabaseAdmin
      .from("drip_enrollments")
      .update({ status: "paused" })
      .eq("campaign_id", id)
      .eq("campaign_type", "unified")
      .eq("status", "active");
  }

  const { data } = await supabase.from("unified_campaigns").select("*").eq("id", id).single();
  return NextResponse.json(activationWarnings.length ? { ...data, warnings: activationWarnings } : data);
}

export async function DELETE(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });

  // Clean up enrollments first
  await supabaseAdmin
    .from("drip_enrollments")
    .delete()
    .eq("campaign_id", id)
    .eq("campaign_type", "unified");

  // Steps are cascade-deleted via FK
  const { error } = await supabase.from("unified_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
