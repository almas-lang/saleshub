import { createClient } from "@/lib/supabase/server";
import {
  startOfWeek,
  subWeeks,
  startOfMonth,
  subMonths,
  startOfDay,
  addDays,
  format,
  differenceInDays,
} from "date-fns";
import type {
  KpiData,
  TodaysFocusItem,
  PipelineStageData,
  PipelineFunnel,
  DashboardActivity,
} from "@/types/dashboard";
import { formatDate } from "@/lib/utils";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { TodaysFocus } from "@/components/dashboard/todays-focus";
import { PipelineOverview } from "@/components/dashboard/pipeline-overview";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { QuickActions } from "@/components/dashboard/quick-actions";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Working late";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName =
    user?.user_metadata?.first_name ?? user?.email?.split("@")[0] ?? "";

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const threeDaysOut = addDays(startOfDay(now), 3).toISOString();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const lastWeekStart = subWeeks(
    startOfWeek(now, { weekStartsOn: 1 }),
    1
  ).toISOString();
  const thisMonthStart = startOfMonth(now).toISOString();
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();

  // Run all queries in parallel
  const [
    newLeadsThisWeek,
    newLeadsLastWeek,
    // Follow-ups: pending tasks due within 3 days
    followUpsNow,
    followUpsLastWeek,
    // Revenue: paid invoices this month
    revenueThisMonth,
    revenueLastMonth,
    // Overdue tasks
    overdueTasksNow,
    overdueTasksLastWeek,
    // Today's Focus: all pending/overdue tasks with contact + funnel + stage
    focusTasksQuery,
    todaysBookings,
    recentlyConverted,
    todaysNewLeads,
    // Pipeline & Activity
    pipelineStagesQuery,
    funnelsQuery,
    activitiesQuery,
    teamMembersQuery,
  ] = await Promise.all([
    // New leads this week
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("type", "prospect")
      .gte("created_at", thisWeekStart)
      .is("deleted_at", null),

    // New leads last week
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("type", "prospect")
      .gte("created_at", lastWeekStart)
      .lt("created_at", thisWeekStart)
      .is("deleted_at", null),

    // Follow-ups: pending tasks due within 3 days
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("due_at", todayStart)
      .lte("due_at", threeDaysOut),

    // Follow-ups last week (same window, shifted)
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("due_at", lastWeekStart)
      .lte("due_at", thisWeekStart),

    // Revenue this month: paid invoices
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", thisMonthStart),

    // Revenue last month
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", lastMonthStart)
      .lt("paid_at", thisMonthStart),

    // Overdue tasks count now
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "overdue"])
      .lt("due_at", now.toISOString())
      .not("due_at", "is", null),

    // Overdue tasks count last week
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "overdue"])
      .lt("due_at", lastWeekStart)
      .not("due_at", "is", null),

    // Today's Focus: all pending/overdue tasks with contact + funnel + stage + priority
    supabase
      .from("tasks")
      .select(
        "id, title, due_at, priority, contacts(id, first_name, last_name, phone, funnel_id, funnels(name), funnel_stages(name, color))"
      )
      .in("status", ["pending", "overdue"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(10),

    // Today's bookings
    supabase
      .from("activities")
      .select(
        "id, title, created_at, contacts(id, first_name, last_name, phone, funnel_stages(name, color))"
      )
      .eq("type", "booking_created")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(3),

    // Recently converted contacts (became customer this week)
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, phone, funnel_stages(name, color)"
      )
      .eq("type", "customer")
      .gte("updated_at", thisWeekStart)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(3),

    // Today's new leads count
    supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, source")
      .eq("type", "prospect")
      .gte("created_at", todayStart)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3),

    // Pipeline stages with counts
    supabase
      .from("funnel_stages")
      .select("id, funnel_id, name, color, contacts(count)")
      .order("order"),

    // Funnels list for pipeline selector
    supabase
      .from("funnels")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),

    // Recent 8 activities with contact name
    supabase
      .from("activities")
      .select(
        "id, type, title, created_at, metadata, contacts(first_name, last_name)"
      )
      .order("created_at", { ascending: false })
      .limit(8),

    // Team members for task form
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Build KPI data
  const revenueThisMonthTotal = (revenueThisMonth.data ?? []).reduce(
    (sum, inv) => sum + (inv.total ?? 0),
    0
  );
  const revenueLastMonthTotal = (revenueLastMonth.data ?? []).reduce(
    (sum, inv) => sum + (inv.total ?? 0),
    0
  );

  const kpiData: KpiData = {
    newLeads: newLeadsThisWeek.count ?? 0,
    newLeadsLastWeek: newLeadsLastWeek.count ?? 0,
    followUps: followUpsNow.count ?? 0,
    followUpsLastWeek: followUpsLastWeek.count ?? 0,
    revenue: revenueThisMonthTotal,
    revenueLastMonth: revenueLastMonthTotal,
    overdueTasks: overdueTasksNow.count ?? 0,
    overdueTasksLastWeek: overdueTasksLastWeek.count ?? 0,
  };

  // Build Today's Focus items
  const focusItems: TodaysFocusItem[] = [];

  // 1. Tasks (overdue + upcoming)
  for (const task of focusTasksQuery.data ?? []) {
    const contact = task.contacts as unknown as {
      id: string;
      first_name: string;
      last_name: string | null;
      phone: string | null;
      funnel_id: string | null;
      funnels: { name: string } | null;
      funnel_stages: { name: string; color: string } | null;
    } | null;

    const isOverdue = task.due_at && new Date(task.due_at) < now;

    if (isOverdue) {
      const daysOverdue = differenceInDays(now, new Date(task.due_at!));
      focusItems.push({
        id: `task-${task.id}`,
        priority: "overdue",
        actionText: `${task.title} — ${daysOverdue}d overdue`,
        contactId: contact?.id ?? null,
        contactName: contact
          ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
          : null,
        contactPhone: contact?.phone ?? null,
        funnelName: contact?.funnels?.name ?? null,
        stageName: contact?.funnel_stages?.name ?? null,
        stageColor: contact?.funnel_stages?.color ?? null,
        contextDetail: null,
        linkTo: contact ? `/prospects/${contact.id}` : "/tasks",
        taskId: task.id,
        taskPriority: task.priority ?? null,
      });
    } else {
      focusItems.push({
        id: `task-${task.id}`,
        priority: "pending",
        actionText: task.title,
        contactId: contact?.id ?? null,
        contactName: contact
          ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
          : null,
        contactPhone: contact?.phone ?? null,
        funnelName: contact?.funnels?.name ?? null,
        stageName: contact?.funnel_stages?.name ?? null,
        stageColor: contact?.funnel_stages?.color ?? null,
        contextDetail: task.due_at ? `Due ${formatDate(task.due_at)}` : null,
        linkTo: contact ? `/prospects/${contact.id}` : "/tasks",
        taskId: task.id,
        taskPriority: task.priority ?? null,
      });
    }
  }

  // 2. Today's bookings
  for (const booking of todaysBookings.data ?? []) {
    const contact = booking.contacts as unknown as {
      id: string;
      first_name: string;
      last_name: string | null;
      phone: string | null;
      funnel_stages: { name: string; color: string } | null;
    } | null;

    focusItems.push({
      id: `booking-${booking.id}`,
      priority: "today",
      actionText: booking.title,
      contactId: contact?.id ?? null,
      contactName: contact
        ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
        : null,
      contactPhone: contact?.phone ?? null,
      funnelName: null,
      stageName: contact?.funnel_stages?.name ?? null,
      stageColor: contact?.funnel_stages?.color ?? null,
      contextDetail: null,
      linkTo: contact ? `/prospects/${contact.id}` : "/calendar",
      taskId: null,
      taskPriority: null,
    });
  }

  // 3. Recently converted contacts
  for (const contact of recentlyConverted.data ?? []) {
    const stage = contact.funnel_stages as unknown as {
      name: string;
      color: string;
    } | null;

    focusItems.push({
      id: `converted-${contact.id}`,
      priority: "positive",
      actionText: "Converted — send invoice or onboard",
      contactId: contact.id,
      contactName: `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`,
      contactPhone: contact.phone,
      funnelName: null,
      stageName: stage?.name ?? null,
      stageColor: stage?.color ?? null,
      contextDetail: null,
      linkTo: `/prospects/${contact.id}`,
      taskId: null,
      taskPriority: null,
    });
  }

  // 4. Today's new leads
  for (const lead of todaysNewLeads.data ?? []) {
    focusItems.push({
      id: `lead-${lead.id}`,
      priority: "info",
      actionText: "New lead — review and qualify",
      contactId: lead.id,
      contactName: `${lead.first_name}${lead.last_name ? ` ${lead.last_name}` : ""}`,
      contactPhone: lead.phone,
      funnelName: null,
      stageName: null,
      stageColor: null,
      contextDetail: lead.source ? `via ${lead.source}` : null,
      linkTo: `/prospects/${lead.id}`,
      taskId: null,
      taskPriority: null,
    });
  }

  // Slice to max 12 items
  const todaysFocus = focusItems.slice(0, 12);

  // Map pipeline stages
  const pipelineStages: PipelineStageData[] = (
    pipelineStagesQuery.data ?? []
  ).map((s) => ({
    id: s.id,
    funnel_id: s.funnel_id,
    name: s.name,
    color: s.color,
    count:
      (s.contacts as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  // Map funnels
  const pipelineFunnels: PipelineFunnel[] = (funnelsQuery.data ?? []).map(
    (f) => ({
      id: f.id,
      name: f.name,
    })
  );

  // Map activities
  const activities: DashboardActivity[] = (activitiesQuery.data ?? []).map(
    (a) => {
      const contact = a.contacts as unknown as {
        first_name: string;
        last_name: string | null;
      } | null;
      return {
        id: a.id,
        type: a.type,
        title: a.title,
        contact_name: contact
          ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ""}`
          : null,
        created_at: a.created_at,
        metadata: (a.metadata as Record<string, unknown>) ?? null,
      };
    }
  );

  return (
    <div className="page-enter space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {format(now, "EEEE, dd MMM yyyy")}
          </p>
        </div>
        <QuickActions
          teamMembers={(teamMembersQuery.data ?? []).map((m) => ({
            id: m.id,
            name: m.name,
          }))}
          funnels={pipelineFunnels}
          stages={(pipelineStagesQuery.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            funnel_id: s.funnel_id,
          }))}
        />
      </div>

      {/* KPI Cards */}
      <KpiCards data={kpiData} />

      {/* Today's Focus */}
      <TodaysFocus items={todaysFocus} />

      {/* Bottom Grid — Pipeline + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
        <PipelineOverview stages={pipelineStages} funnels={pipelineFunnels} />
        <ActivityFeed activities={activities} />
      </div>
    </div>
  );
}
