import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { markAsRead } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status progression — higher index = further along
const STATUS_ORDER = ["queued", "sent", "delivered", "read"] as const;

function statusRank(s: string): number {
  const idx = STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

/** Strip to digits, ensure 91 country code (mirrors client.ts formatForWA) */
function formatForWA(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned;
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
}

// ── GET: Meta webhook verification ────────────────────

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    console.log("[WA Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WA Webhook] Verification failed — token mismatch");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST: Receive events from Meta ────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const entries = body?.entry ?? [];
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            await handleIncomingMessage(message);
          }
        }
      }
    }
  } catch (err) {
    console.error("[WA Webhook] Error processing webhook:", err);
  }

  // Always return 200 to prevent Meta retries
  return NextResponse.json({ success: true }, { status: 200 });
}

// ── Status update handler ─────────────────────────────

async function handleStatusUpdate(status: {
  id: string;
  status: string;
  timestamp: string;
  errors?: { code: number; title: string }[];
}) {
  const { id: waMessageId, status: newStatus, timestamp } = status;
  const ts = new Date(parseInt(timestamp) * 1000).toISOString();

  // Look up the wa_sends record
  const { data: send, error: lookupErr } = await supabaseAdmin
    .from("wa_sends")
    .select("id, status, contact_id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[WA Webhook] wa_sends lookup error:", lookupErr.message);
    return;
  }

  if (!send) {
    // Message not tracked by us — ignore
    return;
  }

  // Handle failed status
  if (newStatus === "failed") {
    const errorInfo = status.errors?.[0];
    console.error(
      `[WA Webhook] Message ${waMessageId} failed:`,
      errorInfo?.title ?? "Unknown error",
      `(code: ${errorInfo?.code ?? "?"})`
    );

    const errMsg = status.errors?.[0]
      ? `${status.errors[0].title} (code: ${status.errors[0].code})`
      : "Unknown error";
    await supabaseAdmin
      .from("wa_sends")
      .update({ status: "failed", error_message: errMsg })
      .eq("id", send.id);
    return;
  }

  // Only upgrade status, never downgrade
  if (statusRank(newStatus) <= statusRank(send.status)) {
    return;
  }

  // Build the update payload
  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "sent") update.sent_at = ts;
  if (newStatus === "delivered") update.delivered_at = ts;
  if (newStatus === "read") update.read_at = ts;

  const { error: updateErr } = await supabaseAdmin
    .from("wa_sends")
    .update(update)
    .eq("id", send.id);

  if (updateErr) {
    console.error("[WA Webhook] wa_sends update error:", updateErr.message);
    return;
  }

  // Log activity for delivered / read
  if (newStatus === "delivered" || newStatus === "read") {
    const activityType = newStatus === "delivered" ? "wa_delivered" : "wa_read";
    await supabaseAdmin.from("activities").insert({
      contact_id: send.contact_id,
      type: activityType,
      title: `WhatsApp message ${newStatus}`,
      metadata: { wa_message_id: waMessageId },
    });
  }
}

// ── Incoming message handler ──────────────────────────

async function handleIncomingMessage(message: {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}) {
  const senderPhone = formatForWA(message.from);
  const senderPhonePlus = `+${senderPhone}`;
  const messageText =
    message.type === "text" ? message.text?.body ?? "" : `[${message.type}]`;

  // Look up contact by phone (try both with and without + prefix)
  const { data: contact, error: contactErr } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .or(`phone.eq.${senderPhone},phone.eq.${senderPhonePlus}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (contactErr) {
    console.error("[WA Webhook] Contact lookup error:", contactErr.message);
    return;
  }

  // Mark as read (blue ticks) regardless of whether we have a contact
  try {
    await markAsRead(message.id);
  } catch (err) {
    console.error("[WA Webhook] markAsRead failed:", err);
  }

  if (!contact) {
    console.log(`[WA Webhook] No contact found for phone ${senderPhone}`);
    return;
  }

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id: contact.id,
    type: "wa_received",
    title: "WhatsApp reply received",
    body: messageText,
    metadata: { wa_message_id: message.id, from: senderPhone },
  });

  // If there's an unreplied wa_sends record, mark as replied
  const { data: unreplied } = await supabaseAdmin
    .from("wa_sends")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("replied", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unreplied) {
    await supabaseAdmin
      .from("wa_sends")
      .update({ replied: true })
      .eq("id", unreplied.id);
  }
}
