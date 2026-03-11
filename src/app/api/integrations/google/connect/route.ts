import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl, disconnect } from "@/lib/google/auth";

/** Verify the request is from an authenticated user */
async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** POST — Generate OAuth URL for a specific team member */
export async function POST(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamMemberId } = (await request.json()) as {
    teamMemberId?: string;
  };

  if (!teamMemberId) {
    return NextResponse.json(
      { error: "teamMemberId is required" },
      { status: 400 }
    );
  }

  const url = getAuthUrl(teamMemberId);
  return NextResponse.json({ url });
}

/** DELETE — Disconnect Google Calendar for a specific team member */
export async function DELETE(request: Request) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamMemberId } = (await request.json()) as {
    teamMemberId?: string;
  };

  if (!teamMemberId) {
    return NextResponse.json(
      { error: "teamMemberId is required" },
      { status: 400 }
    );
  }

  const result = await disconnect(teamMemberId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
