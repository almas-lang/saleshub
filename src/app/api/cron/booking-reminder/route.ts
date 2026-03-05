import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { renderBookingReminderEmail } from "@/lib/email/templates/booking-reminder";
import { format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ── Auth ─────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Window: bookings starting 23–25 hours from now
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    // ── Query upcoming confirmed bookings in the 23–25h window ──
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("id, contact_id, starts_at, ends_at, meet_link")
      .eq("status", "confirmed")
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd);

    if (error) {
      console.error("[Booking Reminder] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!bookings?.length) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let emailsSent = 0;

    for (const booking of bookings) {
      // Check if reminder was already sent for this booking
      const { count } = await supabaseAdmin
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", booking.contact_id)
        .eq("type", "email_sent")
        .eq("metadata->>template", "booking-reminder");

      if ((count ?? 0) > 0) continue;

      // Get contact details
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("first_name, email")
        .eq("id", booking.contact_id)
        .single();

      if (!contact?.email) continue;

      const startsAt = new Date(booking.starts_at);
      const dateStr = format(startsAt, "MMMM d, yyyy");
      const timeStr = format(startsAt, "h:mm a");

      try {
        const { subject, html } = await renderBookingReminderEmail({
          firstName: contact.first_name || "there",
          date: dateStr,
          time: timeStr,
          hostName: "Shaik Murad",
          meetLink: booking.meet_link || "#",
        });

        const result = await sendEmail({
          to: contact.email,
          subject,
          html,
        });

        if (result.success) {
          await supabaseAdmin.from("activities").insert({
            contact_id: booking.contact_id,
            type: "email_sent",
            title: "Booking reminder email sent",
            metadata: { template: "booking-reminder", booking_id: booking.id },
          });
          emailsSent++;
        }
      } catch (err) {
        console.error(
          `[Booking Reminder] Failed for ${contact.email}:`,
          err
        );
      }
    }

    return NextResponse.json({ success: true, processed: bookings.length, emailsSent });
  } catch (error) {
    console.error("[Booking Reminder] Cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
