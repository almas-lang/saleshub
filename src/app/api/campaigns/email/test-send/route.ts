import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";
import { renderDripEmail } from "@/lib/email/templates/drip-wrapper";
import { z } from "zod";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  preview_text: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { to, subject, body_html, preview_text } = parsed.data;

  // Use the same plain wrapper as actual campaign emails
  const { html } = await renderDripEmail({
    subject,
    bodyHtml: body_html,
    preview: preview_text,
  });

  const result = await sendEmail({
    to,
    subject: `[TEST] ${subject}`,
    html,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 502 });
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
