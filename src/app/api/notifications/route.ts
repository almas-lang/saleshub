import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  // Fetch latest 20 notifications + unread count in parallel
  const [notifResult, countResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", member.id)
      .eq("read", false),
  ]);

  if (notifResult.error) {
    return NextResponse.json({ error: notifResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: notifResult.data ?? [],
    unread_count: countResult.count ?? 0,
  });
}
