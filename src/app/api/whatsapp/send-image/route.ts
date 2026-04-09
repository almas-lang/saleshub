/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadMedia, sendImageMessage } from "@/lib/whatsapp/client";

const admin = supabaseAdmin as any;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/whatsapp/send-image
 * Upload and send an image via WhatsApp.
 * Accepts FormData: contact_id, file, caption (optional).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const contactId = formData.get("contact_id") as string;
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) || undefined;

  if (!contactId || !file) {
    return NextResponse.json(
      { error: "contact_id and file are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are supported" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Image must be under 5MB" },
      { status: 400 }
    );
  }

  // Look up contact phone
  const { data: contact, error: contactErr } = await supabaseAdmin
    .from("contacts")
    .select("phone")
    .eq("id", contactId)
    .single();

  if (contactErr || !contact?.phone) {
    return NextResponse.json(
      { error: "Contact not found or has no phone number" },
      { status: 404 }
    );
  }

  // Upload media to WhatsApp
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await uploadMedia(buffer, file.type, file.name);

  if (!uploadResult.success || !uploadResult.mediaId) {
    return NextResponse.json(
      { error: uploadResult.error ?? "Failed to upload media" },
      { status: 502 }
    );
  }

  // Send image message
  const sendResult = await sendImageMessage(
    contact.phone,
    uploadResult.mediaId,
    caption
  );

  if (!sendResult.success) {
    return NextResponse.json(
      { error: sendResult.error ?? "Failed to send image" },
      { status: 502 }
    );
  }

  // Store in wa_messages
  const { data: waMessage } = await admin
    .from("wa_messages")
    .insert({
      contact_id: contactId,
      direction: "outbound",
      body: caption ?? null,
      message_type: "image",
      wa_message_id: sendResult.messageId ?? null,
      status: "sent",
      metadata: {
        media_id: uploadResult.mediaId,
        mime_type: file.type,
        filename: file.name,
      },
    })
    .select()
    .single();

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id: contactId,
    user_id: user.id,
    type: "wa_sent",
    title: "WhatsApp image sent",
    body: caption ?? "[image]",
  });

  return NextResponse.json({
    success: true,
    messageId: sendResult.messageId,
    message: waMessage,
  });
}
