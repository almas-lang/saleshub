import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

/**
 * POST /api/whatsapp/reply
 * Send a free-text WhatsApp reply to a contact (within 24h window).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contact_id, message, context_message_id } = (await req.json()) as {
    contact_id: string;
    message: string;
    context_message_id?: string;
  };

  if (!contact_id || !message?.trim()) {
    return NextResponse.json(
      { error: "contact_id and message are required" },
      { status: 400 }
    );
  }

  // Look up contact phone
  const { data: contact, error: contactErr } = await supabaseAdmin
    .from("contacts")
    .select("phone")
    .eq("id", contact_id)
    .single();

  if (contactErr || !contact?.phone) {
    return NextResponse.json(
      { error: "Contact not found or has no phone number" },
      { status: 404 }
    );
  }

  // Send via WhatsApp Cloud API (free-text, requires 24h window)
  const result = await sendTextMessage(contact.phone, message.trim(), context_message_id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send message. The 24h conversation window may have expired — use a template instead." },
      { status: 502 }
    );
  }

  // Store in wa_messages
  const { data: waMessage } = await admin
    .from("wa_messages")
    .insert({
      contact_id,
      direction: "outbound",
      body: message.trim(),
      message_type: "text",
      wa_message_id: result.messageId ?? null,
      status: "sent",
      metadata: context_message_id ? { context_message_id } : null,
    })
    .select()
    .single();

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id,
    user_id: user.id,
    type: "wa_sent",
    title: "WhatsApp reply sent",
    body: message.trim(),
  });

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    message: waMessage,
  });
}
