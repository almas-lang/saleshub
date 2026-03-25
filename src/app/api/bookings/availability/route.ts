import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFreeBusy } from "@/lib/google/calendar";
import type { AvailabilityRules, DaySchedule } from "@/types/bookings";

/**
 * POST /api/bookings/availability
 * Body: { slug: string, date: string (YYYY-MM-DD) }
 * Returns available time slots for a given date.
 *
 * Logic:
 * 1. Fetch booking page by slug
 * 2. Check if the requested day is enabled in availability rules
 * 3. Generate candidate slots based on duration + buffer
 * 4. Subtract Google Calendar busy times for all assigned team members
 * 5. Check existing bookings to respect max_per_day limit
 * 6. Return available slots with assigned team member
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { slug, date } = body as { slug?: string; date?: string };

  if (!slug || !date) {
    return NextResponse.json(
      { error: "slug and date are required" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Fetch booking page
  const { data: page, error } = await supabaseAdmin
    .from("booking_pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !page) {
    return NextResponse.json({ error: "Booking page not found" }, { status: 404 });
  }

  const rules = page.availability_rules as unknown as AvailabilityRules | null;
  if (!rules) {
    return NextResponse.json({ error: "No availability rules configured" }, { status: 400 });
  }

  // Check booking window — reject dates beyond the allowed window
  const bookingWindowDays = rules.booking_window_days || 60;
  const requestedDate = new Date(date + "T00:00:00");
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + bookingWindowDays);
  maxDate.setHours(23, 59, 59, 999);
  if (requestedDate > maxDate) {
    return NextResponse.json({ data: [] });
  }

  // Check what day of the week this is
  const dayOfWeek = requestedDate.getDay(); // 0=Sun, 6=Sat
  const daySchedule: DaySchedule | undefined = rules.schedule.find(
    (d) => d.day === dayOfWeek
  );

  if (!daySchedule || !daySchedule.enabled) {
    return NextResponse.json({ data: [] });
  }

  // Check if date is blocked
  if (rules.blocked_dates.includes(date)) {
    return NextResponse.json({ data: [] });
  }

  // Check existing bookings count for this day to enforce max_per_day
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;

  const { count: existingBookingCount } = await supabaseAdmin
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("booking_page_id", page.id)
    .neq("status", "cancelled")
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  if ((existingBookingCount ?? 0) >= rules.max_per_day) {
    return NextResponse.json({ data: [] });
  }

  // Get assigned team members — only those with Google Calendar connected
  const assignedIds: string[] = page.assigned_to ?? [];
  const isSpecificMode = rules.assignment_mode === "specific";

  let teamMemberIds: string[];

  if (assignedIds.length > 0) {
    // Prefer connected members from the assigned list
    const { data: connectedAssigned } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("is_active", true)
      .eq("google_calendar_connected", true)
      .in("id", assignedIds);
    teamMemberIds = (connectedAssigned ?? []).map((m) => m.id);

    // In specific mode, only use the first assigned member — no fallback
    if (isSpecificMode && teamMemberIds.length > 0) {
      teamMemberIds = [teamMemberIds[0]];
    }

    // If none of the assigned members are connected, fall back to any connected member
    // (only in round_robin mode — specific mode shows no slots if the person is disconnected)
    if (teamMemberIds.length === 0 && !isSpecificMode) {
      const { data: anyConnected } = await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("is_active", true)
        .eq("google_calendar_connected", true);
      teamMemberIds = (anyConnected ?? []).map((m) => m.id);
    }
  } else {
    // No specific assignment — use all connected active members
    const { data: allConnected } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("is_active", true)
      .eq("google_calendar_connected", true);
    teamMemberIds = (allConnected ?? []).map((m) => m.id);
  }

  if (teamMemberIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Generate candidate time slots
  const tz = rules.timezone ?? "Asia/Kolkata";
  const duration = page.duration_minutes;
  const buffer = rules.buffer_minutes;

  const [startH, startM] = daySchedule.start_time.split(":").map(Number);
  const [endH, endM] = daySchedule.end_time.split(":").map(Number);

  const slots: { start: string; end: string }[] = [];
  let cursor = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (cursor + duration <= endMinutes) {
    const slotStartH = Math.floor(cursor / 60);
    const slotStartM = cursor % 60;
    const slotEndMin = cursor + duration;
    const slotEndH = Math.floor(slotEndMin / 60);
    const slotEndM = slotEndMin % 60;

    const startStr = `${date}T${String(slotStartH).padStart(2, "0")}:${String(slotStartM).padStart(2, "0")}:00`;
    const endStr = `${date}T${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}:00`;

    slots.push({ start: startStr, end: endStr });
    cursor += duration + buffer;
  }

  if (slots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Filter out past slots (if date is today)
  const now = new Date();
  const futureSlots = slots.filter((s) => {
    const slotTime = parseDateInTz(s.start, tz);
    return slotTime > now;
  });

  if (futureSlots.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Get existing bookings for this page on this date (to filter already-booked slots)
  const { data: existingBookings } = await supabaseAdmin
    .from("bookings")
    .select("starts_at, ends_at, assigned_to")
    .eq("booking_page_id", page.id)
    .neq("status", "cancelled")
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  // For each team member, get their Google Calendar busy times
  const dayStartDate = parseDateInTz(`${date}T00:00:00`, tz);
  const dayEndDate = parseDateInTz(`${date}T23:59:59`, tz);

  const memberBusyMap = new Map<string, { start: Date; end: Date }[]>();

  // Fetch free/busy for each member; exclude members whose API call fails
  // (treating a failed member as "fully free" would cause double-bookings)
  const failedMemberIds = new Set<string>();

  await Promise.all(
    teamMemberIds.map(async (memberId) => {
      const result = await getFreeBusy(memberId, dayStartDate, dayEndDate);

      if (!result.success) {
        // Cannot verify availability — exclude this member entirely
        failedMemberIds.add(memberId);
        console.error(
          `[Availability] getFreeBusy failed for ${memberId}: ${result.error}`
        );
        return;
      }

      const busySlots = (result.data ?? []).map((b) => ({
        start: new Date(b.start),
        end: new Date(b.end),
      }));

      // Also add existing bookings for this member
      const memberBookings = (existingBookings ?? [])
        .filter((b) => b.assigned_to === memberId)
        .map((b) => ({
          start: new Date(b.starts_at),
          end: new Date(b.ends_at),
        }));

      memberBusyMap.set(memberId, [...busySlots, ...memberBookings]);
    })
  );

  // Remove members with failed API calls from the pool
  const validMemberIds = teamMemberIds.filter((id) => !failedMemberIds.has(id));

  if (validMemberIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Build a global list of already-booked time ranges for this page
  // (regardless of which team member was assigned) — prevents double-booking
  // the same slot across different team members.
  const bookedSlots = (existingBookings ?? []).map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  // For round-robin, find any available member for each slot
  // For specific mode, all assigned members must be checked
  const availableSlots: {
    start: string;
    end: string;
    time: string;
    assignedTo: string;
  }[] = [];

  const remainingPerDay = rules.max_per_day - (existingBookingCount ?? 0);

  for (const slot of futureSlots) {
    if (availableSlots.length >= remainingPerDay) break;

    const slotStart = parseDateInTz(slot.start, tz);
    const slotEnd = parseDateInTz(slot.end, tz);
    // Add buffer around the slot for conflict checking
    const bufferMs = buffer * 60 * 1000;
    const slotStartWithBuffer = new Date(slotStart.getTime() - bufferMs);
    const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferMs);

    // Skip slot if it overlaps any existing booking on this page (any member)
    const alreadyBooked = bookedSlots.some(
      (b) => b.start < slotEndWithBuffer && b.end > slotStartWithBuffer
    );
    if (alreadyBooked) continue;

    // Find a free team member for this slot
    let assignedMember: string | null = null;

    for (const memberId of validMemberIds) {
      const busy = memberBusyMap.get(memberId) ?? [];
      const hasConflict = busy.some(
        (b) => b.start < slotEndWithBuffer && b.end > slotStartWithBuffer
      );

      if (!hasConflict) {
        assignedMember = memberId;
        break;
      }
    }

    if (assignedMember) {
      const timeStr = slot.start.split("T")[1].slice(0, 5); // "10:00"
      availableSlots.push({
        start: slot.start,
        end: slot.end,
        time: timeStr,
        assignedTo: assignedMember,
      });
    }
  }

  return NextResponse.json({ data: availableSlots });
}

/**
 * Parse a local datetime string in a given timezone and return a UTC Date.
 * e.g. parseDateInTz("2026-03-15T10:00:00", "Asia/Kolkata")
 */
function parseDateInTz(dateStr: string, tz: string): Date {
  if (dateStr.includes("Z") || dateStr.includes("+")) {
    return new Date(dateStr);
  }

  // Parse components from the string directly (no new Date() which uses local tz)
  const [datePart, timePart] = dateStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart || "00:00:00").split(":").map(Number);

  // Create a UTC date with these components first
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));

  // Find out what wall-clock time `utcGuess` would show in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcGuess);
  const p = (type: string) => Number(parts.find((x) => x.type === type)?.value || 0);
  const wallInTz = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour") === 24 ? 0 : p("hour"), p("minute"), p("second"));

  // The difference tells us the timezone offset at that moment
  const offset = wallInTz - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offset);
}
