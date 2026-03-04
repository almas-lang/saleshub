import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type EmailSendStatus = Database["public"]["Enums"]["email_send_status"];
type ActivityType = Database["public"]["Enums"]["activity_type"];

// Status progression rank — higher = further along the funnel
const STATUS_RANK: Record<EmailSendStatus, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  bounced: 99,
  failed: 99,
};

// Map Resend event types to our status + activity + timestamp field
const EVENT_MAP: Record<
  string,
  {
    status: EmailSendStatus;
    activity?: ActivityType;
    timestampField?: "sent_at" | "opened_at" | "clicked_at";
  }
> = {
  "email.sent": { status: "sent", activity: "email_sent", timestampField: "sent_at" },
  "email.delivered": { status: "delivered" },
  "email.opened": { status: "opened", activity: "email_opened", timestampField: "opened_at" },
  "email.clicked": { status: "clicked", activity: "email_opened", timestampField: "clicked_at" },
  "email.bounced": { status: "bounced" },
  "email.complained": { status: "failed" },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const eventType: string = body.type;
    const data = body.data;

    // Ignore events we don't handle
    const mapping = EVENT_MAP[eventType];
    if (!mapping) {
      return NextResponse.json({ received: true });
    }

    // Extract message ID from Resend payload
    const messageId: string | undefined =
      data?.email_id ?? data?.message_id;

    if (!messageId) {
      return NextResponse.json({ received: true });
    }

    // Look up the email_sends record
    const { data: emailSend } = await supabaseAdmin
      .from("email_sends")
      .select("id, contact_id, status")
      .eq("resend_message_id", messageId)
      .maybeSingle();

    if (!emailSend) {
      // Not our email — ignore silently
      return NextResponse.json({ received: true });
    }

    // Only upgrade status (don't downgrade), unless it's bounced/failed
    const currentRank = STATUS_RANK[emailSend.status] ?? 0;
    const newRank = STATUS_RANK[mapping.status] ?? 0;
    const shouldUpdate = newRank > currentRank || newRank === 99;

    if (shouldUpdate) {
      const updates: Record<string, unknown> = { status: mapping.status };

      if (mapping.timestampField) {
        updates[mapping.timestampField] = new Date().toISOString();
      }

      await supabaseAdmin
        .from("email_sends")
        .update(updates)
        .eq("id", emailSend.id);
    }

    // Log activity on the contact (only for meaningful events)
    if (mapping.activity) {
      await supabaseAdmin.from("activities").insert({
        contact_id: emailSend.contact_id,
        type: mapping.activity,
        title:
          mapping.activity === "email_sent"
            ? "Email sent"
            : "Email opened",
        metadata: {
          resend_message_id: messageId,
          event: eventType,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    // Always return 200 to prevent Resend retries
    return NextResponse.json({ received: true });
  }
}
