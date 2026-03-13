import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { teamMemberSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  // Allow partial updates (role change, deactivation, full edit)
  const parsed = teamMemberSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  // Handle is_active separately (not in schema but needed for deactivation)
  if ("is_active" in body && typeof body.is_active === "boolean") {
    payload.is_active = body.is_active;
  }

  if (parsed.data.phone !== undefined) {
    payload.phone = parsed.data.phone || null;
  }

  const { data, error } = await supabase
    .from("team_members")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Soft deactivate — set is_active = false
  const { data, error } = await supabase
    .from("team_members")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
