import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { weeklyAnalyticsHtml } from "@/lib/email/templates/weekly-analytics";
import { subWeeks, startOfWeek, endOfWeek, format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const from = lastWeekStart.toISOString();
  const to = lastWeekEnd.toISOString();

  // Get opted-in team members
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name, email, notification_preferences")
    .eq("is_active", true);

  const optedIn = (members ?? []).filter((m) => {
    const prefs = m.notification_preferences as Record<string, boolean> | null;
    return prefs?.weekly_analytics_email !== false; // default opt-in
  });

  if (optedIn.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no opted-in members" });
  }

  // Fetch metrics
  const [leadsRes, customersRes, revenueRes, tasksRes] = await Promise.all([
    supabaseAdmin
      .from("contacts")
      .select("id, source", { count: "exact" })
      .eq("type", "prospect")
      .gte("created_at", from)
      .lte("created_at", to)
      .is("deleted_at", null),
    supabaseAdmin
      .from("contacts")
      .select("id", { count: "exact" })
      .eq("type", "customer")
      .gte("converted_at", from)
      .lte("converted_at", to)
      .is("deleted_at", null),
    supabaseAdmin
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", from)
      .lte("paid_at", to),
    supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact" })
      .eq("status", "completed")
      .gte("updated_at", from)
      .lte("updated_at", to),
  ]);

  const newLeads = leadsRes.count ?? 0;
  const conversions = customersRes.count ?? 0;
  const revenue = (revenueRes.data ?? []).reduce((s, i) => s + (i.total ?? 0), 0);
  const tasksCompleted = tasksRes.count ?? 0;

  // Top source
  const sourceCounts = new Map<string, number>();
  for (const l of leadsRes.data ?? []) {
    const src = l.source || "Direct";
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }
  const topSource = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const period = `${format(lastWeekStart, "dd MMM")} – ${format(lastWeekEnd, "dd MMM yyyy")}`;

  // Send email to each opted-in member
  let sent = 0;
  for (const member of optedIn) {
    if (!member.email) continue;

    const html = weeklyAnalyticsHtml({
      recipientName: member.name.split(" ")[0],
      period,
      newLeads,
      conversions,
      revenue: formatCurrency(revenue),
      tasksCompleted,
      topSource,
    });

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `SalesHub <noreply@${process.env.RESEND_DOMAIN ?? "xperiencewave.com"}>`,
          to: member.email,
          subject: `Weekly Analytics — ${period}`,
          html,
        }),
      });
      sent++;
    } catch (err) {
      console.error(`[Weekly Analytics] Failed to send to ${member.email}:`, err);
    }
  }

  return NextResponse.json({ sent, total: optedIn.length });
}
