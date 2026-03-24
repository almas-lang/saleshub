/**
 * Google Calendar API wrapper
 * Reference: ARCHITECTURE.md Section 7.4, PHASE2_SETUP.md Step 4
 *
 * Uses direct REST API calls with google-auth-library for auth,
 * instead of the heavyweight googleapis SDK.
 */

import { getAccessToken } from "./auth";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

// ── Types ──────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;
  meetLink?: string;
  attendees?: string[];
}

export interface CreateEventOptions {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
  timeZone?: string;
}

export interface CreateEventResult {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  error?: string;
}

export interface CalendarResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BusySlot {
  start: string;
  end: string;
}

// ── Helpers ─────────────────────────────────────────

async function calendarFetch(
  token: string,
  path: string,
  options?: RequestInit
) {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error?.message ?? `Google API error (${res.status})`
    );
  }

  // DELETE returns 204 with no body
  if (res.status === 204) return null;
  return res.json();
}

// ── Public API ──────────────────────────────────────

/**
 * Get free/busy data for a team member's calendar.
 * Used by the availability engine to find open booking slots.
 */
export async function getFreeBusy(
  teamMemberId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarResult<BusySlot[]>> {
  const token = await getAccessToken(teamMemberId);
  if (!token) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const data = await calendarFetch(token, "/freeBusy", {
      method: "POST",
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    const busy: BusySlot[] =
      data?.calendars?.primary?.busy?.map(
        (slot: { start?: string; end?: string }) => ({
          start: slot.start ?? "",
          end: slot.end ?? "",
        })
      ) ?? [];

    return { success: true, data: busy };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Calendar] freeBusy error:", message);
    return { success: false, error: message };
  }
}

/**
 * Create a calendar event with auto-generated Google Meet link.
 */
export async function createEvent(
  teamMemberId: string,
  options: CreateEventOptions
): Promise<CreateEventResult> {
  const token = await getAccessToken(teamMemberId);
  if (!token) {
    return { success: false, error: "Google Calendar not connected — token missing or expired" };
  }

  const timeZone = options.timeZone ?? "Asia/Kolkata";

  const baseEventBody: Record<string, unknown> = {
    summary: options.summary,
    description: options.description,
    start: { dateTime: options.start.toISOString(), timeZone },
    end: { dateTime: options.end.toISOString(), timeZone },
  };

  if (options.attendeeEmail) {
    baseEventBody.attendees = [{ email: options.attendeeEmail }];
  }

  // Try with Google Meet conference link first
  try {
    const eventBody = {
      ...baseEventBody,
      conferenceData: {
        createRequest: {
          requestId: `saleshub-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const data = await calendarFetch(
      token,
      "/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      { method: "POST", body: JSON.stringify(eventBody) }
    );

    return {
      success: true,
      eventId: data?.id ?? undefined,
      meetLink: data?.hangoutLink ?? undefined,
    };
  } catch (confErr) {
    const confMessage = confErr instanceof Error ? confErr.message : "Unknown error";
    console.warn("[Google Calendar] createEvent with conferenceData failed, retrying without:", confMessage);

    // Fallback: create event without Meet link
    try {
      const data = await calendarFetch(
        token,
        "/calendars/primary/events?sendUpdates=all",
        { method: "POST", body: JSON.stringify(baseEventBody) }
      );

      return {
        success: true,
        eventId: data?.id ?? undefined,
        meetLink: undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Google Calendar] createEvent error:", message);
      return { success: false, error: message };
    }
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  teamMemberId: string,
  eventId: string
): Promise<CalendarResult<void>> {
  const token = await getAccessToken(teamMemberId);
  if (!token) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    await calendarFetch(
      token,
      `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: "DELETE" }
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Calendar] deleteEvent error:", message);
    return { success: false, error: message };
  }
}

/**
 * List events in a date range.
 */
export async function listEvents(
  teamMemberId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarResult<CalendarEvent[]>> {
  const token = await getAccessToken(teamMemberId);
  if (!token) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });

    const data = await calendarFetch(
      token,
      `/calendars/primary/events?${params}`
    );

    const events: CalendarEvent[] =
      data?.items?.map(
        (item: {
          id?: string;
          summary?: string;
          description?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          hangoutLink?: string;
          attendees?: { email?: string }[];
        }) => ({
          id: item.id ?? "",
          summary: item.summary ?? "",
          description: item.description ?? undefined,
          start: item.start?.dateTime ?? item.start?.date ?? "",
          end: item.end?.dateTime ?? item.end?.date ?? "",
          meetLink: item.hangoutLink ?? undefined,
          attendees: item.attendees
            ?.map((a: { email?: string }) => a.email ?? "")
            .filter(Boolean),
        })
      ) ?? [];

    return { success: true, data: events };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Calendar] listEvents error:", message);
    return { success: false, error: message };
  }
}
