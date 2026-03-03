import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { funnelSchema, funnelStageSchema } from "@/lib/validations";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("funnels")
    .select("*, funnel_stages(*)")
    .eq("id", id)
    .order("order", { referencedTable: "funnel_stages" })
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

const patchSchema = funnelSchema.partial().extend({
  stages: z.array(funnelStageSchema).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { stages, ...funnelData } = parsed.data;

  // Update funnel metadata if provided
  if (Object.keys(funnelData).length > 0) {
    const { error: updateError } = await supabase
      .from("funnels")
      .update(funnelData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  // Replace stages if provided (delete all, re-insert)
  if (stages) {
    const { error: deleteError } = await supabase
      .from("funnel_stages")
      .delete()
      .eq("funnel_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const stageRows = stages.map((s) => ({
      funnel_id: id,
      name: s.name,
      order: s.order,
      color: s.color,
      is_terminal: s.is_terminal ?? false,
    }));

    const { error: insertError } = await supabase
      .from("funnel_stages")
      .insert(stageRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Return updated funnel with stages
  const { data } = await supabase
    .from("funnels")
    .select("*, funnel_stages(*)")
    .eq("id", id)
    .order("order", { referencedTable: "funnel_stages" })
    .single();

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check if any contacts are assigned to this funnel
  const { count } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("funnel_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete funnel: ${count} contact(s) are assigned to it` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("funnels").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
