import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/test
 * Creates a test notification for the current user.
 * Body (all optional): { title, body, link }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const json = await request.json().catch(() => ({}));

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: member.id,
      title: json.title ?? "Test notification",
      body: json.body ?? "This is a test notification created at " + new Date().toLocaleTimeString(),
      link: json.link ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
