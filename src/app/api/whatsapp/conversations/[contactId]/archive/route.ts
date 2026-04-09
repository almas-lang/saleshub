/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const admin = supabaseAdmin as any;

/**
 * POST /api/whatsapp/conversations/[contactId]/archive
 * Archive a WhatsApp conversation.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await admin
    .from("wa_archived_chats")
    .upsert({ contact_id: contactId }, { onConflict: "contact_id" });

  if (error) {
    console.error("[WA Archive] archive error:", error);
    return NextResponse.json({ error: "Failed to archive chat" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/whatsapp/conversations/[contactId]/archive
 * Unarchive a WhatsApp conversation.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await admin
    .from("wa_archived_chats")
    .delete()
    .eq("contact_id", contactId);

  if (error) {
    console.error("[WA Archive] unarchive error:", error);
    return NextResponse.json({ error: "Failed to unarchive chat" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
