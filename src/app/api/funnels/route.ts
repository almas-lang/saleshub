import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { funnelSchema, funnelStageSchema } from "@/lib/validations";
import { z } from "zod";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("funnels")
    .select("*, funnel_stages(count)")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the count from [{count: n}] to a number
  const funnels = data.map((f) => ({
    ...f,
    stage_count: f.funnel_stages?.[0]?.count ?? 0,
  }));

  return NextResponse.json(funnels);
}

const createFunnelSchema = funnelSchema.extend({
  stages: z.array(funnelStageSchema).min(1, "At least one stage is required"),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();
  const parsed = createFunnelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { stages, ...funnelData } = parsed.data;

  // Insert funnel
  const { data: funnel, error: funnelError } = await supabase
    .from("funnels")
    .insert(funnelData)
    .select()
    .single();

  if (funnelError) {
    return NextResponse.json({ error: funnelError.message }, { status: 500 });
  }

  // Insert stages
  const stageRows = stages.map((s) => ({
    funnel_id: funnel.id,
    name: s.name,
    order: s.order,
    color: s.color,
    is_terminal: s.is_terminal ?? false,
  }));

  const { error: stagesError } = await supabase
    .from("funnel_stages")
    .insert(stageRows);

  if (stagesError) {
    // Clean up the funnel if stages fail
    await supabase.from("funnels").delete().eq("id", funnel.id);
    return NextResponse.json({ error: stagesError.message }, { status: 500 });
  }

  // Return funnel with stages
  const { data: result } = await supabase
    .from("funnels")
    .select("*, funnel_stages(*)")
    .eq("id", funnel.id)
    .order("order", { referencedTable: "funnel_stages" })
    .single();

  return NextResponse.json(result, { status: 201 });
}
