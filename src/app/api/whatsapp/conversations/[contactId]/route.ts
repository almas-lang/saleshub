import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

/**
 * GET /api/whatsapp/conversations/[contactId]
 * Returns all WA messages for a specific contact, ordered chronologically.
 * Also merges inbound messages from activities (fallback until webhook deploys).
 */
export async function GET(
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

  // Fetch messages from wa_messages
  const { data: waMessages } = await admin
    .from("wa_messages")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true })
    .limit(500);

  // Also fetch inbound messages from activities (wa_reply / note with wa_message_id)
  // This catches messages received before the webhook was updated
  const { data: inboundActivities } = await supabaseAdmin
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .in("type", ["wa_reply", "note"] as any)
    .not("metadata", "is", null)
    .order("created_at", { ascending: true })
    .limit(500);

  // Build a set of wa_message_ids already in wa_messages
  const existingWaIds = new Set(
    (waMessages ?? [])
      .filter((m: any) => m.wa_message_id)
      .map((m: any) => m.wa_message_id)
  );

  // Convert activities with wa_message_id metadata into wa_messages format
  const activityMessages: any[] = [];
  for (const act of inboundActivities ?? []) {
    const meta = act.metadata as Record<string, any> | null;
    if (!meta?.wa_message_id) continue;
    // Skip if already in wa_messages
    if (existingWaIds.has(meta.wa_message_id)) continue;
    // Only include WA-related activities
    if (!meta.from && (act.type as string) !== "wa_reply") continue;

    activityMessages.push({
      id: act.id,
      contact_id: act.contact_id,
      direction: "inbound",
      body: act.body,
      message_type: "text",
      wa_message_id: meta.wa_message_id,
      status: null,
      metadata: null,
      created_at: act.created_at,
    });
  }

  // Merge and sort by created_at
  const allMessages = [...(waMessages ?? []), ...activityMessages].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Fetch contact info
  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, phone, avatar_url")
    .eq("id", contactId)
    .single();

  return NextResponse.json({ messages: allMessages, contact });
}
