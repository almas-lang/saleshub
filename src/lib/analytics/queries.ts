import { createClient } from "@/lib/supabase/server";
import { format, eachDayOfInterval, parseISO, subDays } from "date-fns";
import type {
  AnalyticsOverview,
  LeadAnalytics,
  PipelineAnalytics,
  CommunicationAnalytics,
  TeamAnalytics,
  SparklinePoint,
} from "@/types/analytics";

// ── Overview ──────────────

export async function getAnalyticsOverview(
  from: string,
  to: string
): Promise<AnalyticsOverview> {
  const supabase = await createClient();

  const [leadsRes, customersRes, revenueRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, created_at")
      .eq("type", "prospect")
      .gte("created_at", from)
      .lte("created_at", to)
      .is("deleted_at", null),
    supabase
      .from("contacts")
      .select("id, converted_at")
      .eq("type", "customer")
      .gte("converted_at", from)
      .lte("converted_at", to)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("total, paid_at")
      .eq("status", "paid")
      .gte("paid_at", from)
      .lte("paid_at", to),
  ]);

  const leads = leadsRes.data ?? [];
  const customers = customersRes.data ?? [];
  const invoices = revenueRes.data ?? [];

  const totalLeads = leads.length;
  const totalConversions = customers.length;
  const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;
  const totalRevenue = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const avgDealSize = totalConversions > 0 ? totalRevenue / totalConversions : 0;

  // Build sparklines (daily for last 30 days)
  const days = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  });

  const leadsByDay = new Map<string, number>();
  for (const l of leads) {
    const d = format(parseISO(l.created_at), "yyyy-MM-dd");
    leadsByDay.set(d, (leadsByDay.get(d) ?? 0) + 1);
  }

  const revenueByDay = new Map<string, number>();
  for (const i of invoices) {
    if (!i.paid_at) continue;
    const d = format(parseISO(i.paid_at), "yyyy-MM-dd");
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + (i.total ?? 0));
  }

  const leadsTrend: SparklinePoint[] = days.map((d) => ({
    date: format(d, "yyyy-MM-dd"),
    value: leadsByDay.get(format(d, "yyyy-MM-dd")) ?? 0,
  }));

  const revenueTrend: SparklinePoint[] = days.map((d) => ({
    date: format(d, "yyyy-MM-dd"),
    value: revenueByDay.get(format(d, "yyyy-MM-dd")) ?? 0,
  }));

  return {
    totalLeads,
    leadsTrend,
    conversionRate,
    conversionTrend: [], // requires historical tracking
    totalRevenue,
    revenueTrend,
    avgDealSize,
    dealSizeTrend: [],
  };
}

// ── Lead Analytics ──────────────

export async function getLeadAnalytics(
  from: string,
  to: string
): Promise<LeadAnalytics> {
  const supabase = await createClient();

  const [leadsRes, customersRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, source, utm_campaign, created_at")
      .eq("type", "prospect")
      .gte("created_at", from)
      .lte("created_at", to)
      .is("deleted_at", null),
    supabase
      .from("contacts")
      .select("id, source, utm_campaign")
      .eq("type", "customer")
      .gte("converted_at", from)
      .lte("converted_at", to)
      .is("deleted_at", null),
  ]);

  const leads = leadsRes.data ?? [];
  const customers = customersRes.data ?? [];

  // By source
  const sourceMap = new Map<string, number>();
  for (const l of leads) {
    const src = l.source || "Direct";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }
  const bySource = Array.from(sourceMap, ([source, count]) => ({
    source,
    count,
  })).sort((a, b) => b.count - a.count);

  // Over time
  const dayMap = new Map<string, number>();
  for (const l of leads) {
    const d = format(parseISO(l.created_at), "yyyy-MM-dd");
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const overTime = days.map((d) => ({
    date: format(d, "yyyy-MM-dd"),
    count: dayMap.get(format(d, "yyyy-MM-dd")) ?? 0,
  }));

  // By campaign (UTM)
  const campaignLeads = new Map<string, number>();
  const campaignConversions = new Map<string, number>();
  for (const l of leads) {
    if (!l.utm_campaign) continue;
    campaignLeads.set(
      l.utm_campaign,
      (campaignLeads.get(l.utm_campaign) ?? 0) + 1
    );
  }
  for (const c of customers) {
    if (!c.utm_campaign) continue;
    campaignConversions.set(
      c.utm_campaign,
      (campaignConversions.get(c.utm_campaign) ?? 0) + 1
    );
  }
  const byCampaign = Array.from(campaignLeads, ([campaign, leads]) => {
    const conversions = campaignConversions.get(campaign) ?? 0;
    return {
      campaign,
      leads,
      conversions,
      conversionRate: leads > 0 ? (conversions / leads) * 100 : 0,
    };
  }).sort((a, b) => b.leads - a.leads);

  const conversionRate =
    leads.length > 0 ? (customers.length / leads.length) * 100 : 0;

  return {
    totalLeads: leads.length,
    bySource,
    overTime,
    byCampaign,
    conversionRate,
  };
}

// ── Pipeline Analytics ──────────────

export async function getPipelineAnalytics(
  funnelId: string
): Promise<PipelineAnalytics> {
  const supabase = await createClient();

  const [funnelRes, stagesRes, contactsRes] = await Promise.all([
    supabase.from("funnels").select("id, name").eq("id", funnelId).single(),
    supabase
      .from("funnel_stages")
      .select("id, name, color, order")
      .eq("funnel_id", funnelId)
      .order("order"),
    supabase
      .from("contacts")
      .select("id, current_stage_id, type")
      .eq("funnel_id", funnelId)
      .is("deleted_at", null),
  ]);

  const funnel = funnelRes.data;
  const stagesList = stagesRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  const stageCountMap = new Map<string, number>();
  for (const c of contacts) {
    if (c.current_stage_id) {
      stageCountMap.set(
        c.current_stage_id,
        (stageCountMap.get(c.current_stage_id) ?? 0) + 1
      );
    }
  }

  const totalContacts = contacts.length;
  const converted = contacts.filter((c) => c.type === "customer").length;

  const stages = stagesList.map((s) => {
    const count = stageCountMap.get(s.id) ?? 0;
    return {
      stageId: s.id,
      stageName: s.name,
      stageColor: s.color,
      count,
      conversionRate: totalContacts > 0 ? (count / totalContacts) * 100 : 0,
      avgDaysInStage: 0, // would need activities table analysis
    };
  });

  return {
    funnelId,
    funnelName: funnel?.name ?? "Unknown",
    stages,
    totalContacts,
    overallConversion:
      totalContacts > 0 ? (converted / totalContacts) * 100 : 0,
  };
}

// ── Communication Analytics ──────────────

export async function getCommunicationAnalytics(
  from: string,
  to: string
): Promise<CommunicationAnalytics> {
  const supabase = await createClient();

  const [waRes, emailRes] = await Promise.all([
    supabase
      .from("wa_sends")
      .select("id, status, created_at")
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("email_sends")
      .select("id, status, created_at")
      .gte("created_at", from)
      .lte("created_at", to),
  ]);

  const waSends = waRes.data ?? [];
  const emailSends = emailRes.data ?? [];

  const metrics = {
    waSent: waSends.filter((w) => w.status !== "failed").length,
    waDelivered: waSends.filter(
      (w) => w.status === "delivered" || w.status === "read"
    ).length,
    waRead: waSends.filter((w) => w.status === "read").length,
    emailSent: emailSends.filter((e) => e.status !== "failed").length,
    emailDelivered: emailSends.filter(
      (e) => e.status === "delivered" || e.status === "opened" || e.status === "clicked"
    ).length,
    emailOpened: emailSends.filter(
      (e) => e.status === "opened" || e.status === "clicked"
    ).length,
    emailClicked: emailSends.filter((e) => e.status === "clicked").length,
  };

  // By day
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
  const waDayMap = new Map<string, number>();
  const emailDayMap = new Map<string, number>();

  for (const w of waSends) {
    const d = format(parseISO(w.created_at), "yyyy-MM-dd");
    waDayMap.set(d, (waDayMap.get(d) ?? 0) + 1);
  }
  for (const e of emailSends) {
    const d = format(parseISO(e.created_at), "yyyy-MM-dd");
    emailDayMap.set(d, (emailDayMap.get(d) ?? 0) + 1);
  }

  const byDay = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      date: key,
      waSent: waDayMap.get(key) ?? 0,
      emailSent: emailDayMap.get(key) ?? 0,
    };
  });

  return { metrics, byDay };
}

// ── Team Analytics ──────────────

export async function getTeamAnalytics(
  from: string,
  to: string
): Promise<TeamAnalytics> {
  const supabase = await createClient();

  const [membersRes, tasksRes, contactsRes, invoicesRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("tasks")
      .select("id, assigned_to, status")
      .eq("status", "completed")
      .gte("updated_at", from)
      .lte("updated_at", to),
    supabase
      .from("contacts")
      .select("id, assigned_to, type, converted_at")
      .is("deleted_at", null)
      .gte("created_at", from)
      .lte("created_at", to),
    supabase
      .from("invoices")
      .select("id, total, contact_id, contacts(assigned_to)")
      .eq("status", "paid")
      .gte("paid_at", from)
      .lte("paid_at", to),
  ]);

  const members = membersRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const memberStats = members.map((m) => {
    const tasksCompleted = tasks.filter((t) => t.assigned_to === m.id).length;
    const leadsAssigned = contacts.filter(
      (c) => c.assigned_to === m.id && c.type === "prospect"
    ).length;
    const conversions = contacts.filter(
      (c) => c.assigned_to === m.id && c.type === "customer"
    ).length;
    const revenue = invoices
      .filter((i) => {
        const contact = i.contacts as unknown as { assigned_to: string | null } | null;
        return contact?.assigned_to === m.id;
      })
      .reduce((s, i) => s + (i.total ?? 0), 0);

    return {
      memberId: m.id,
      memberName: m.name,
      tasksCompleted,
      leadsAssigned,
      conversions,
      revenue,
    };
  });

  return {
    members: memberStats,
    totalTasks: tasks.length,
    totalLeads: contacts.filter((c) => c.type === "prospect").length,
    totalConversions: contacts.filter((c) => c.type === "customer").length,
    totalRevenue: invoices.reduce((s, i) => s + (i.total ?? 0), 0),
  };
}
