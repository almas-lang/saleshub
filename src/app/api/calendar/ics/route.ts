import { NextRequest, NextResponse } from "next/server";

/**
 * Generates an .ics file for Apple Calendar / any calendar client.
 * Query params: title, start (ISO), end (ISO), location?, description?
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get("title") || "Meeting";
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const location = searchParams.get("location") || "";
  const description = searchParams.get("description") || "";

  if (!start || !end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  function toIcsDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  const uid = `${startDate.getTime()}-${Math.random().toString(36).slice(2)}@xperiencewave.com`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Xperience Wave//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
    location ? `LOCATION:${escapeIcs(location)}` : "",
    description ? `DESCRIPTION:${escapeIcs(description)}` : "",
    `DTSTAMP:${toIcsDate(new Date())}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
