import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  startOfDay,
  subDays,
  startOfWeek,
  startOfMonth,
  format,
} from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret (header or query param)
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
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const thisMonthStart = startOfMonth(now).toISOString();

    // Get all active team members
    const { data: members, error: membersError } = await supabaseAdmin
      .from("team_members")
      .select("id, name, email")
      .eq("is_active", true);

    if (membersError || !members?.length) {
      return NextResponse.json({
        success: false,
        error: membersError?.message ?? "No active team members found",
      });
    }

    // Run all queries in parallel
    const [
      yesterdayLeads,
      weekLeads,
      yesterdayCompletedTasks,
      yesterdayActivities,
      yesterdayConversions,
      overdueTasks,
      tasksDueToday,
      pendingFollowUps,
      pipelineStages,
      revenueThisMonth,
    ] = await Promise.all([
      // New leads yesterday
      supabaseAdmin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("type", "prospect")
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart)
        .is("deleted_at", null),

      // New leads this week
      supabaseAdmin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("type", "prospect")
        .gte("created_at", thisWeekStart)
        .is("deleted_at", null),

      // Tasks completed yesterday
      supabaseAdmin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_at", yesterdayStart)
        .lt("completed_at", todayStart),

      // Total activities yesterday
      supabaseAdmin
        .from("activities")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart),

      // Conversions yesterday (prospects -> customers)
      supabaseAdmin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("type", "customer")
        .gte("converted_at", yesterdayStart)
        .lt("converted_at", todayStart),

      // Overdue tasks
      supabaseAdmin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "overdue"])
        .lt("due_at", todayStart)
        .not("due_at", "is", null),

      // Tasks due today
      supabaseAdmin
        .from("tasks")
        .select("id, title, priority, contacts(first_name, last_name)")
        .eq("status", "pending")
        .gte("due_at", todayStart)
        .lt("due_at", startOfDay(subDays(now, -1)).toISOString()),

      // Pending follow-ups (next 3 days)
      supabaseAdmin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("type", "follow_up")
        .not("due_at", "is", null),

      // Pipeline: top 5 stages by contact count
      supabaseAdmin
        .from("funnel_stages")
        .select("name, color, contacts(count)")
        .eq("is_terminal", false)
        .order("order"),

      // Revenue this month
      supabaseAdmin
        .from("invoices")
        .select("total")
        .eq("status", "paid")
        .gte("paid_at", thisMonthStart),
    ]);

    // Build stats
    const yesterdayLeadCount = yesterdayLeads.count ?? 0;
    const weekLeadCount = weekLeads.count ?? 0;
    const completedCount = yesterdayCompletedTasks.count ?? 0;
    const activityCount = yesterdayActivities.count ?? 0;
    const conversionCount = yesterdayConversions.count ?? 0;
    const overdueCount = overdueTasks.count ?? 0;
    const dueTodayCount = tasksDueToday.data?.length ?? 0;
    const followUpCount = pendingFollowUps.count ?? 0;
    const monthRevenue = (revenueThisMonth.data ?? []).reduce(
      (sum, inv) => sum + (inv.total ?? 0),
      0
    );

    // Build pipeline summary (non-terminal stages with contacts)
    const pipelineSummary = (pipelineStages.data ?? [])
      .map((s) => ({
        name: s.name,
        count:
          (s.contacts as unknown as { count: number }[])?.[0]?.count ?? 0,
      }))
      .filter((s) => s.count > 0)
      .slice(0, 5)
      .map((s) => `${s.name}: ${s.count}`)
      .join(" | ");

    // Build today's task highlights
    const taskHighlights = (tasksDueToday.data ?? [])
      .slice(0, 3)
      .map((t) => {
        const contact = t.contacts as unknown as {
          first_name: string;
          last_name: string | null;
        } | null;
        const name = contact
          ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
          : null;
        return name ? `${t.title} (${name})` : t.title;
      });

    // Compose notification
    const dateStr = format(subDays(now, 1), "dd MMM");
    const todayStr = format(now, "EEEE, dd MMM");

    const lines: string[] = [];

    // Yesterday summary
    const yesterdayParts: string[] = [];
    if (yesterdayLeadCount > 0)
      yesterdayParts.push(`${yesterdayLeadCount} new lead${yesterdayLeadCount !== 1 ? "s" : ""}`);
    if (completedCount > 0)
      yesterdayParts.push(`${completedCount} task${completedCount !== 1 ? "s" : ""} completed`);
    if (conversionCount > 0)
      yesterdayParts.push(`${conversionCount} conversion${conversionCount !== 1 ? "s" : ""}`);
    if (activityCount > 0)
      yesterdayParts.push(`${activityCount} activit${activityCount !== 1 ? "ies" : "y"}`);

    if (yesterdayParts.length > 0) {
      lines.push(`Yesterday (${dateStr}): ${yesterdayParts.join(", ")}.`);
    } else {
      lines.push(`Yesterday (${dateStr}): No activity recorded.`);
    }

    // Today's action items
    const todayParts: string[] = [];
    if (overdueCount > 0)
      todayParts.push(`${overdueCount} overdue`);
    if (dueTodayCount > 0)
      todayParts.push(`${dueTodayCount} due today`);
    if (followUpCount > 0)
      todayParts.push(`${followUpCount} follow-up${followUpCount !== 1 ? "s" : ""} pending`);

    if (todayParts.length > 0) {
      lines.push(`Tasks: ${todayParts.join(", ")}.`);
    }

    // Task highlights
    if (taskHighlights.length > 0) {
      lines.push(`Top tasks: ${taskHighlights.join("; ")}.`);
    }

    // Pipeline snapshot
    if (pipelineSummary) {
      lines.push(`Pipeline: ${pipelineSummary}.`);
    }

    // Week + month stats
    const extraParts: string[] = [];
    if (weekLeadCount > 0)
      extraParts.push(`${weekLeadCount} leads this week`);
    if (monthRevenue > 0)
      extraParts.push(
        `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(monthRevenue)} revenue this month`
      );
    if (extraParts.length > 0) {
      lines.push(extraParts.join(" | "));
    }

    const title = `Daily Digest — ${todayStr}`;
    const body = lines.join("\n");

    // Create notification for each team member
    const notifications = members.map((member) => ({
      user_id: member.id,
      title,
      body,
      link: "/dashboard",
      read: false,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notified: members.length,
      summary: { yesterdayLeadCount, completedCount, conversionCount, overdueCount, dueTodayCount },
    });
  } catch (error) {
    console.error("Daily digest cron error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
