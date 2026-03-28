export interface SparklinePoint {
  date: string;
  value: number;
}

export interface KpiData {
  newLeads: number;
  newLeadsLastWeek: number;
  followUps: number;
  followUpsLastWeek: number;
  revenue: number;
  revenueLastMonth: number;
  overdueTasks: number;
  overdueTasksLastWeek: number;
  conversionRate: number;
  conversionRateLastMonth: number;
  revenueSparkline?: SparklinePoint[];
}

export interface TeamSummaryItem {
  id: string;
  name: string;
  tasksCompleted: number;
  leadsAssigned: number;
  revenue: number;
}

export interface CommunicationPulse {
  date: string;
  wa: number;
  email: number;
}

export interface TodaysFocusItem {
  id: string;
  priority: "overdue" | "pending" | "today" | "positive" | "info";
  actionText: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  funnelName: string | null;
  stageName: string | null;
  stageColor: string | null;
  contextDetail: string | null;
  linkTo: string;
  taskId: string | null;
  taskPriority: string | null;
}

export interface PipelineFunnel {
  id: string;
  name: string;
}

export interface PipelineStageData {
  id: string;
  funnel_id: string;
  name: string;
  color: string;
  count: number;
}

export interface DashboardActivity {
  id: string;
  type: string;
  title: string;
  contact_name: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}
