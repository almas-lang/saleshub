import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUrl, disconnect } from "@/lib/google/auth";
import { getFreeBusy, listEvents } from "@/lib/google/calendar";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "connect";
  const memberId = searchParams.get("member");

  // Get specific member or first active one
  let memberQuery = supabaseAdmin
    .from("team_members")
    .select("id, name, email, google_calendar_connected");

  if (memberId) {
    memberQuery = memberQuery.eq("id", memberId);
  } else {
    memberQuery = memberQuery.eq("is_active", true).order("created_at", { ascending: true }).limit(1);
  }

  const { data: member } = await memberQuery.single();

  if (!member) {
    return NextResponse.json({ error: "No team member found" }, { status: 404 });
  }

  if (action === "status") {
    return NextResponse.json({
      member: member.name,
      email: member.email,
      teamMemberId: member.id,
      googleConnected: member.google_calendar_connected,
    });
  }

  if (action === "disconnect") {
    const result = await disconnect(member.id);
    return NextResponse.json(result);
  }

  if (action === "connect") {
    const url = getAuthUrl(member.id);
    return NextResponse.redirect(url);
  }

  if (action === "events") {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const result = await listEvents(member.id, now, nextWeek);
    return NextResponse.json(result);
  }

  if (action === "freebusy") {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const result = await getFreeBusy(member.id, now, tomorrow);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action. Use: status, connect, events, freebusy" }, { status: 400 });
}
