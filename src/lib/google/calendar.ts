/**
 * Google Calendar API wrapper
 * Reference: ARCHITECTURE.md Section 7.4, PHASE2_SETUP.md Step 4
 *
 * Manages calendar events, free/busy lookups, and Google Meet link generation.
 * Requires an authenticated OAuth2 client per team member (see auth.ts).
 */

import { google, calendar_v3 } from "googleapis";
import { getAuthenticatedClient } from "./auth";

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
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busy =
      res.data.calendars?.primary?.busy?.map((slot) => ({
        start: slot.start ?? "",
        end: slot.end ?? "",
      })) ?? [];

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
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  const timeZone = options.timeZone ?? "Asia/Kolkata";

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const eventBody: calendar_v3.Schema$Event = {
      summary: options.summary,
      description: options.description,
      start: {
        dateTime: options.start.toISOString(),
        timeZone,
      },
      end: {
        dateTime: options.end.toISOString(),
        timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: `saleshub-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    if (options.attendeeEmail) {
      eventBody.attendees = [{ email: options.attendeeEmail }];
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventBody,
      conferenceDataVersion: 1,
      sendUpdates: "all",
    });

    return {
      success: true,
      eventId: res.data.id ?? undefined,
      meetLink: res.data.hangoutLink ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Calendar] createEvent error:", message);
    return { success: false, error: message };
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  teamMemberId: string,
  eventId: string
): Promise<CalendarResult<void>> {
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });

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
  const auth = await getAuthenticatedClient(teamMemberId);
  if (!auth) {
    return { success: false, error: "Google Calendar not connected" };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const events: CalendarEvent[] =
      res.data.items?.map((item) => ({
        id: item.id ?? "",
        summary: item.summary ?? "",
        description: item.description ?? undefined,
        start: item.start?.dateTime ?? item.start?.date ?? "",
        end: item.end?.dateTime ?? item.end?.date ?? "",
        meetLink: item.hangoutLink ?? undefined,
        attendees: item.attendees?.map((a) => a.email ?? "").filter(Boolean),
      })) ?? [];

    return { success: true, data: events };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Calendar] listEvents error:", message);
    return { success: false, error: message };
  }
}
