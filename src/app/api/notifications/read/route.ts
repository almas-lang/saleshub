import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve team_member by auth_user_id, fallback to email
  let { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!member && user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", user.email)
      .single();
    member = byEmail;
  }

  if (!member) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.all) {
    // Mark all as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", member.id)
      .eq("read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    // Mark specific IDs as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", member.id)
      .in("id", body.ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json(
      { error: "Provide { ids: string[] } or { all: true }" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
