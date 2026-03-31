import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/whatsapp/unread
 * Returns count of unread WA notifications for the current user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  // Find the team member for this auth user
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ count: 0 });
  }

  // Count unread notifications with WA links
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", member.id)
    .eq("read", false)
    .like("link", "/whatsapp/%");

  if (error) {
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
