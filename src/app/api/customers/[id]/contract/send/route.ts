import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import {
  renderContractEmail,
  CONTRACT_ATTACHMENT_FILENAME,
} from "@/lib/contracts/email-template";
import { fillContractPdf } from "@/lib/contracts/fill-contract";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone")
    .eq("id", id)
    .single();

  if (error || !contact) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  let overrides: {
    name?: string;
    email?: string;
    phone?: string;
    scheduled_at?: string | null;
  } = {};
  try {
    overrides = await request.json();
  } catch {
    // empty body is fine
  }

  const name =
    overrides.name?.trim() ||
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  const email = overrides.email?.trim() || contact.email || "";
  const phone = overrides.phone?.trim() || contact.phone || null;

  let scheduledAtIso: string | null = null;
  if (overrides.scheduled_at) {
    const parsed = new Date(overrides.scheduled_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled_at value" },
        { status: 400 }
      );
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }
    scheduledAtIso = parsed.toISOString();
  }

  if (!email) {
    return NextResponse.json(
      { error: "Customer must have an email to send contract" },
      { status: 400 }
    );
  }

  const { subject, html } = renderContractEmail({ name });

  const contractDate = scheduledAtIso ? new Date(scheduledAtIso) : new Date();

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await fillContractPdf({ name, sentAt: contractDate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to prepare contract PDF: ${message}` },
      { status: 500 }
    );
  }

  const result = await sendEmail({
    to: email,
    subject,
    html,
    tags: [{ name: "type", value: "contract" }],
    attachments: [
      {
        filename: CONTRACT_ATTACHMENT_FILENAME,
        content: pdfBytes,
        contentType: "application/pdf",
      },
    ],
    scheduledAt: scheduledAtIso ?? undefined,
  });

  const isScheduled = !!scheduledAtIso && result.success;
  const status = !result.success
    ? "failed"
    : isScheduled
      ? "scheduled"
      : "sent";

  const sendRow = {
    contact_id: contact.id,
    sent_to_name: name,
    sent_to_email: email,
    sent_to_phone: phone,
    resend_message_id: result.messageId ?? null,
    scheduled_at: scheduledAtIso,
    status,
    error: result.success ? null : (result.error ?? "Unknown error"),
  };

  const activityBody = isScheduled
    ? `Enrollment contract scheduled for ${new Date(scheduledAtIso!).toLocaleString()} → ${email}`
    : `Enrollment contract emailed to ${email}`;

  await Promise.all([
    supabaseAdmin.from("contract_sends").insert(sendRow),
    result.success
      ? supabaseAdmin.from("activities").insert({
          contact_id: contact.id,
          type: "contract_sent",
          title: isScheduled ? "Contract scheduled" : "Contract sent",
          body: activityBody,
        })
      : Promise.resolve(),
  ]);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message_id: result.messageId,
    scheduled: isScheduled,
    scheduled_at: scheduledAtIso,
  });
}
