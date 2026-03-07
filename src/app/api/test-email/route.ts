import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/client";
import { renderWelcomeEmail } from "@/lib/email/templates/welcome";
import { renderBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { renderNoBookNudgeEmail } from "@/lib/email/templates/no-book-nudge";
import { renderNoBook24hEmail } from "@/lib/email/templates/no-book-24h";
import { renderBookingReminderEmail } from "@/lib/email/templates/booking-reminder";
import { renderNoBook48hEmail } from "@/lib/email/templates/no-book-48h";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to");
  const template = searchParams.get("template") ?? "welcome";
  const firstName = searchParams.get("name") ?? "Friend";

  if (!to) {
    return NextResponse.json({ error: "Missing ?to=email@example.com" }, { status: 400 });
  }

  let subject: string;
  let html: string;

  switch (template) {
    case "welcome": {
      const r = await renderWelcomeEmail({ firstName });
      subject = r.subject; html = r.html;
      break;
    }
    case "booking-confirmation": {
      const r = await renderBookingConfirmationEmail({ firstName });
      subject = r.subject; html = r.html;
      break;
    }
    case "no-book-nudge": {
      const r = await renderNoBookNudgeEmail({ firstName });
      subject = r.subject; html = r.html;
      break;
    }
    case "no-book-24h": {
      const r = await renderNoBook24hEmail({ firstName });
      subject = r.subject; html = r.html;
      break;
    }
    case "no-book-48h": {
      const r = await renderNoBook48hEmail({ firstName });
      subject = r.subject; html = r.html;
      break;
    }
    case "booking-reminder": {
      const r = await renderBookingReminderEmail({
        firstName,
        date: "March 10, 2026",
        time: "2:00 PM",
        hostName: "Shaik Murad",
        meetLink: "https://meet.google.com/test",
      });
      subject = r.subject; html = r.html;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
  }

  const result = await sendEmail({ to, subject, html });
  return NextResponse.json(result);
}
