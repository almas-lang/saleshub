import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validations";
import { enrollContactByTrigger } from "@/lib/campaigns/trigger-enroll";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch contact with joins
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // Fetch activities, tasks, and form responses in parallel
  const [activitiesResult, tasksResult, formResponsesResult] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("*")
      .eq("contact_id", id)
      .in("status", ["pending", "overdue"])
      .order("due_at", { ascending: true }),
    supabase
      .from("contact_form_responses")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ...contact,
    activities: activitiesResult.data ?? [],
    tasks: tasksResult.data ?? [],
    form_responses: formResponsesResult.data ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const parsed = contactSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Clean empty strings to null for FK fields
  const cleaned: Record<string, unknown> = { ...parsed.data };
  for (const key of ["email", "funnel_id", "current_stage_id", "assigned_to", "linkedin_url"]) {
    if (cleaned[key] === "") cleaned[key] = null;
  }

  // If stage is changing, read old stage before update
  let oldStageName: string | null = null;
  let newStageName: string | null = null;

  if (cleaned.current_stage_id !== undefined) {
    // Get current contact's stage
    const { data: current } = await supabase
      .from("contacts")
      .select("current_stage_id")
      .eq("id", id)
      .single();

    if (current?.current_stage_id) {
      const { data: oldStage } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .eq("id", current.current_stage_id)
        .single();
      oldStageName = oldStage?.name ?? null;
    }

    // Get new stage name
    if (cleaned.current_stage_id) {
      const { data: newStage } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .eq("id", cleaned.current_stage_id as string)
        .single();
      newStageName = newStage?.name ?? null;
    }
  }

  // Update contact
  const { error: updateError } = await supabase
    .from("contacts")
    .update(cleaned)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log stage change activity if stage actually changed
  if (
    cleaned.current_stage_id !== undefined &&
    oldStageName !== newStageName
  ) {
    await supabase.from("activities").insert({
      contact_id: id,
      type: "stage_change",
      title: `Stage changed from ${oldStageName ?? "None"} to ${newStageName ?? "None"}`,
      metadata: {
        old_stage_name: oldStageName,
        new_stage_name: newStageName,
        old_stage_id: null,
        new_stage_id: cleaned.current_stage_id,
      },
    });

    // Stop active drip enrollments whose campaign has a stop_condition matching this stage
    if (cleaned.current_stage_id) {
      const newStageId = cleaned.current_stage_id as string;

      // Find all active enrollments for this contact
      const { data: activeEnrollments } = await supabaseAdmin
        .from("drip_enrollments")
        .select("id, campaign_id, campaign_type")
        .eq("contact_id", id)
        .eq("status", "active");

      if (activeEnrollments?.length) {
        // Check each enrollment's campaign for a matching stop condition
        for (const enrollment of activeEnrollments) {
          const table = enrollment.campaign_type === "unified" ? "unified_campaigns"
            : enrollment.campaign_type === "email" ? "email_campaigns" : "wa_campaigns";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: camp } = await (supabaseAdmin as any)
            .from(table)
            .select("stop_condition")
            .eq("id", enrollment.campaign_id)
            .single();

          const stopCond = camp?.stop_condition as { stage_id: string } | null;
          if (stopCond?.stage_id === newStageId) {
            await supabaseAdmin.from("drip_enrollments")
              .update({ status: "stopped", stopped_reason: "stage_exit_condition" })
              .eq("id", enrollment.id);
          }
        }
      }

      // Trigger enrollment for "stage_changed" campaigns
      await enrollContactByTrigger(id, "stage_changed", newStageId).catch(() => {});
    }
  }

  // Return updated contact with joins
  const { data } = await supabase
    .from("contacts")
    .select("*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)")
    .eq("id", id)
    .single();

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stop all active drip enrollments for this contact
  await supabaseAdmin
    .from("drip_enrollments")
    .update({ status: "stopped", stopped_reason: "contact_deleted" })
    .eq("contact_id", id)
    .in("status", ["active", "paused"]);

  return NextResponse.json({ success: true });
}
