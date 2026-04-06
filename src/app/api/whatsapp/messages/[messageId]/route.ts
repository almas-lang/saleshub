/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const admin = supabaseAdmin as any;

/**
 * DELETE /api/whatsapp/messages/[messageId]
 * Soft-delete a WA message.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await admin
    .from("wa_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    console.error("[WA Messages] delete error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
