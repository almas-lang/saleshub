/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const admin = supabaseAdmin as any;

/**
 * GET /api/whatsapp/conversations
 * Returns contacts that have WA messages, with last message preview.
 * Merges inbound from activities as fallback until webhook deploys.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch from wa_messages
  const { data: waRows } = await admin
    .from("wa_messages")
    .select(
      "contact_id, body, direction, message_type, created_at, contacts(id, first_name, last_name, phone, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  // Also fetch inbound from activities (fallback for pre-deploy messages)
  const { data: inboundActivities } = await supabaseAdmin
    .from("activities")
    .select("contact_id, body, created_at, metadata, contacts(id, first_name, last_name, phone, avatar_url)")
    .in("type", ["wa_reply", "note"] as any)
    .not("metadata", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // Collect wa_message_ids already covered by wa_messages
  const existingWaIds = new Set(
    (waRows ?? [])
      .filter((r: any) => r.wa_message_id)
      .map((r: any) => r.wa_message_id)
  );

  // Build unified row list
  const allRows: any[] = [...(waRows ?? [])];

  for (const act of inboundActivities ?? []) {
    const meta = act.metadata as Record<string, any> | null;
    if (!meta?.wa_message_id) continue;
    if (existingWaIds.has(meta.wa_message_id)) continue;
    if (!meta.from && !(act as any).type?.startsWith("wa_")) continue;

    allRows.push({
      contact_id: act.contact_id,
      body: act.body,
      direction: "inbound",
      message_type: "text",
      created_at: act.created_at,
      contacts: act.contacts,
    });
  }

  // Sort by created_at desc
  allRows.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Dedupe by contact_id, keep latest message
  const seen = new Map<
    string,
    {
      contact_id: string;
      last_message: string | null;
      last_message_direction: string;
      last_message_type: string;
      last_message_at: string;
      contact: unknown;
      unread_count: number;
    }
  >();

  for (const row of allRows) {
    if (!seen.has(row.contact_id)) {
      seen.set(row.contact_id, {
        contact_id: row.contact_id,
        last_message: row.body,
        last_message_direction: row.direction,
        last_message_type: row.message_type,
        last_message_at: row.created_at,
        contact: row.contacts,
        unread_count: 0,
      });
    }
  }

  return NextResponse.json(Array.from(seen.values()));
}
