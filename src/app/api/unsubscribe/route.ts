import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token;
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  // Decode contact ID from token
  let contactId: string;
  try {
    contactId = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("contacts")
    .update({ email_unsubscribed_at: new Date().toISOString() })
    .eq("id", contactId)
    .is("email_unsubscribed_at", null);

  if (error) {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
