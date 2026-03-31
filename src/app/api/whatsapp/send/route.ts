import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/client";

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { contact_id, template_name, params = [], param_names, language = "en" } = body as {
    contact_id: string;
    template_name: string;
    params?: string[];
    param_names?: string[];
    language?: string;
  };

  if (!contact_id || !template_name) {
    return NextResponse.json(
      { error: "contact_id and template_name are required" },
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

  // Send via WhatsApp Cloud API
  const result = await sendTemplate(contact.phone, template_name, params, language, param_names);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send WhatsApp message" },
      { status: 502 }
    );
  }

  // Insert wa_sends record
  await supabaseAdmin.from("wa_sends").insert({
    contact_id,
    wa_message_id: result.messageId ?? null,
    status: "queued",
    sent_at: new Date().toISOString(),
  });

  // Log activity
  await supabaseAdmin.from("activities").insert({
    contact_id,
    user_id: user.id,
    type: "wa_sent",
    title: `WhatsApp template sent: ${template_name}`,
  });

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
  });
}
