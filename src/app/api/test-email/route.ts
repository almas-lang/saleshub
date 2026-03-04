import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/client";

export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to");

  if (!to) {
    return NextResponse.json({ error: "Missing ?to=email@example.com" }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject: "SalesHub Test Email",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #1a1a1a; font-size: 24px;">SalesHub Email Test</h1>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          If you're reading this, Resend is working correctly with your
          <strong>xperiencewave.com</strong> domain.
        </p>
        <p style="color: #999; font-size: 14px; margin-top: 32px;">
          Sent from SalesHub via Resend API
        </p>
      </div>
    `,
  });

  return NextResponse.json(result);
}
