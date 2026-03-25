import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAccessToken } from "@/lib/google/auth";
import { sendEmail } from "@/lib/email/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron: validate all Google Calendar connections.
 * For each connected team member, attempt a lightweight API call.
 * If it fails, mark as disconnected and send an alert email.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  const isAuthed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    querySecret === process.env.CRON_SECRET;

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: members } = await supabaseAdmin
      .from("team_members")
      .select("id, name, email, google_calendar_connected")
      .eq("google_calendar_connected", true)
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return NextResponse.json({ success: true, checked: 0, disconnected: 0 });
    }

    let disconnected = 0;

    for (const member of members) {
      const token = await getAccessToken(member.id);

      if (!token) {
        // getAccessToken already marks as disconnected on failure
        disconnected++;

        // Send alert email if member has an email
        if (member.email) {
          await sendEmail({
            to: member.email,
            subject: "Google Calendar Disconnected — Action Required",
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#333">Google Calendar Disconnected</h2>
                <p>Hi ${member.name},</p>
                <p>Your Google Calendar connection to SalesHub has been lost. This means:</p>
                <ul>
                  <li>New bookings won't appear on your Google Calendar</li>
                  <li>Google Meet links won't be generated</li>
                  <li>Your availability can't be checked for scheduling</li>
                </ul>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.xperiencewave.com"}/settings/integrations/connect" style="display:inline-block;background:#4A6CF7;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Reconnect Google Calendar</a></p>
                <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
                <p style="color:#999;font-size:12px">SalesHub — Xperience Wave</p>
              </div>
            `,
          }).catch(() => {
            // Best-effort alert
          });
        }

        continue;
      }

      // Validate token with a lightweight API call (calendar list)
      try {
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 401 || res.status === 403) {
          // Token is invalid — mark as disconnected
          await supabaseAdmin
            .from("team_members")
            .update({ google_calendar_connected: false })
            .eq("id", member.id);
          disconnected++;

          if (member.email) {
            await sendEmail({
              to: member.email,
              subject: "Google Calendar Disconnected — Action Required",
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                  <h2 style="color:#333">Google Calendar Disconnected</h2>
                  <p>Hi ${member.name},</p>
                  <p>Your Google Calendar access was revoked. Please reconnect to continue receiving bookings.</p>
                  <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.xperiencewave.com"}/settings/integrations/connect" style="display:inline-block;background:#4A6CF7;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Reconnect Google Calendar</a></p>
                  <hr style="margin:30px 0;border:none;border-top:1px solid #eee" />
                  <p style="color:#999;font-size:12px">SalesHub — Xperience Wave</p>
                </div>
              `,
            }).catch(() => {});
          }
        }
      } catch {
        // Network error — don't mark as disconnected, could be transient
      }
    }

    return NextResponse.json({
      success: true,
      checked: members.length,
      disconnected,
    });
  } catch (error) {
    console.error("[Calendar Health] Cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
