/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const admin = supabaseAdmin as any;

/**
 * GET /api/whatsapp/conversations?archived=true
 * Returns contacts that have WA messages, with last message preview.
 * Pass ?archived=true to get archived conversations only.
 */
export async function GET(request: NextRequest) {
  const showArchived = request.nextUrl.searchParams.get("archived") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Strategy: collect contact_ids from both wa_messages and WA-related activities,
  // then fetch contact info separately (avoids join issues with untyped client).

  // 1. Get messages from wa_messages (if any exist)
  const { data: waRows, error: waErr } = await admin
    .from("wa_messages")
    .select("contact_id, body, direction, message_type, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (waErr) {
    console.error("[WA Conversations] wa_messages query error:", waErr);
  }

  // 2. Get WA-related activities as fallback (for messages before wa_messages table existed)
  const { data: waActivities, error: actErr } = await supabaseAdmin
    .from("activities")
    .select("contact_id, body, created_at, metadata, type")
    .in("type", ["wa_reply", "wa_sent", "wa_delivered", "wa_read", "note"] as any)
    .not("metadata", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (actErr) {
    console.error("[WA Conversations] activities query error:", actErr);
  }

  // Build a map of contact_id → latest message
  const contactMap = new Map<
    string,
    {
      contact_id: string;
      last_message: string | null;
      last_message_direction: string;
      last_message_type: string;
      last_message_at: string;
    }
  >();

  // Process wa_messages first (most reliable)
  for (const row of waRows ?? []) {
    if (!contactMap.has(row.contact_id)) {
      contactMap.set(row.contact_id, {
        contact_id: row.contact_id,
        last_message: row.body,
        last_message_direction: row.direction,
        last_message_type: row.message_type,
        last_message_at: row.created_at,
      });
    }
  }

  // Then fill in from activities (only contacts not already found)
  for (const act of waActivities ?? []) {
    if (contactMap.has(act.contact_id)) continue;
    const meta = act.metadata as Record<string, any> | null;
    // Only include activities that are WA-related
    if (!meta?.wa_message_id && !meta?.from) continue;

    const isInbound = (act.type as string) === "wa_reply" || (act.type === "note" && meta?.from);
    contactMap.set(act.contact_id, {
      contact_id: act.contact_id,
      last_message: act.body,
      last_message_direction: isInbound ? "inbound" : "outbound",
      last_message_type: "text",
      last_message_at: act.created_at,
    });
  }

  if (contactMap.size === 0) {
    return NextResponse.json([]);
  }

  // Filter by archived status
  const { data: archivedRows } = await admin
    .from("wa_archived_chats")
    .select("contact_id");
  const archivedSet = new Set(
    (archivedRows ?? []).map((r: any) => r.contact_id)
  );
  for (const cid of contactMap.keys()) {
    const isArchived = archivedSet.has(cid);
    if (showArchived ? !isArchived : isArchived) {
      contactMap.delete(cid);
    }
  }

  if (contactMap.size === 0) {
    return NextResponse.json([]);
  }

  // 3. Fetch contact info for all contact_ids in one query
  const contactIds = Array.from(contactMap.keys());
  // Include soft-deleted contacts so we can still show their name/phone
  const { data: contacts, error: contactsErr } = await supabaseAdmin
    .from("contacts")
    .select("id, first_name, last_name, phone")
    .in("id", contactIds);

  if (contactsErr) {
    console.error("[WA Conversations] contacts query error:", contactsErr);
  }

  const contactLookup = new Map(
    (contacts ?? []).map((c: any) => [c.id, c])
  );

  // Debug: log when contacts aren't found
  for (const cid of contactIds) {
    if (!contactLookup.has(cid)) {
      console.warn(`[WA Conversations] Contact not found for id: ${cid}`);
    }
  }

  // 4. Build final response sorted by last_message_at desc
  const conversations = Array.from(contactMap.values())
    .map((conv) => ({
      ...conv,
      contact: contactLookup.get(conv.contact_id) ?? null,
      unread_count: 0,
    }))
    .sort(
      (a, b) =>
        new Date(b.last_message_at).getTime() -
        new Date(a.last_message_at).getTime()
    );

  return NextResponse.json(conversations);
}
