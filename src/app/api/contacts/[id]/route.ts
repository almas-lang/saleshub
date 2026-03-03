import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contactSchema } from "@/lib/validations";

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

  return NextResponse.json({ success: true });
}
