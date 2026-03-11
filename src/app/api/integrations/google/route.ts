import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl, disconnect } from "@/lib/google/auth";

/** Resolve the current user's team_member record */
async function getTeamMember() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  let { data: member } = await supabase
    .from("team_members")
    .select("id, google_calendar_connected")
    .eq("auth_user_id", user.id)
    .single();

  if (!member && user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id, google_calendar_connected")
      .eq("email", user.email)
      .single();
    member = byEmail;
  }

  return member;
}

/** GET — Returns Google Calendar connection status */
export async function GET() {
  const member = await getTeamMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    connected: member.google_calendar_connected ?? false,
  });
}

/** POST — Generates Google OAuth consent URL */
export async function POST() {
  const member = await getTeamMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getAuthUrl(member.id);
  return NextResponse.json({ url });
}

/** DELETE — Disconnects Google Calendar */
export async function DELETE() {
  const member = await getTeamMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await disconnect(member.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
