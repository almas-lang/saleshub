import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";
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

  // Wrap body in a simple email layout
  const html = `
    ${preview_text ? `<div style="display:none;max-height:0;overflow:hidden">${preview_text}</div>` : ""}
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      ${body_html}
      <hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5"/>
      <p style="font-size:11px;color:#999;margin-top:12px">
        This is a test email sent from SalesHub campaign preview.
      </p>
    </div>
  `;

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
