import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/whatsapp/mark-read
 * Mark all WA notifications for a contact as read.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contact_id } = (await req.json()) as { contact_id: string };
  if (!contact_id) {
    return NextResponse.json({ error: "contact_id required" }, { status: 400 });
  }

  // Find team member for this auth user
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ ok: true });
  }

  // Mark all unread WA notifications for this contact as read
  const link = `/whatsapp/chat?contact=${contact_id}`;
  await supabaseAdmin
    .from("notifications")
    .update({ read: true })
    .eq("user_id", member.id)
    .eq("read", false)
    .eq("link", link);

  return NextResponse.json({ ok: true });
}
