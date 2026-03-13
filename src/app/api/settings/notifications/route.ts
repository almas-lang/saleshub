import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve team member
  let member = null;

  const { data: byAuth } = await supabase
    .from("team_members")
    .select("id, notification_preferences")
    .eq("auth_user_id", user.id)
    .single();

  if (byAuth) {
    member = byAuth;
  } else if (user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id, notification_preferences")
      .eq("email", user.email)
      .single();
    member = byEmail;
  }

  if (!member) {
    return NextResponse.json(
      { error: "Team member not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: member.id,
    preferences: member.notification_preferences ?? {},
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { preferences } = body;

  if (!preferences || typeof preferences !== "object") {
    return NextResponse.json(
      { error: "Invalid preferences" },
      { status: 400 }
    );
  }

  // Resolve team member
  let memberId: string | null = null;

  const { data: byAuth } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (byAuth) {
    memberId = byAuth.id;
  } else if (user.email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id")
      .eq("email", user.email)
      .single();
    memberId = byEmail?.id ?? null;
  }

  if (!memberId) {
    return NextResponse.json(
      { error: "Team member not found" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("team_members")
    .update({
      notification_preferences: preferences,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .select("id, notification_preferences")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
