/**
 * Generate "Add to Google Calendar" and "Add to Apple Calendar" URLs
 * for a booking with a given start/end time and details.
 */

function toGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildGoogleCalendarUrl({
  title,
  startsAt,
  endsAt,
  meetLink,
  description,
}: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  meetLink?: string | null;
  description?: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toGoogleDate(startsAt)}/${toGoogleDate(endsAt)}`,
  });

  const details = [description, meetLink ? `Join: ${meetLink}` : ""]
    .filter(Boolean)
    .join("\n");
  if (details) params.set("details", details);
  if (meetLink) params.set("location", meetLink);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildAppleCalendarUrl({
  title,
  startsAt,
  endsAt,
  meetLink,
  description,
  baseUrl,
}: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  meetLink?: string | null;
  description?: string;
  baseUrl: string;
}): string {
  const params = new URLSearchParams({
    title,
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
  });
  if (meetLink) params.set("location", meetLink);
  if (description) params.set("description", description);

  return `${baseUrl}/api/calendar/ics?${params.toString()}`;
}
