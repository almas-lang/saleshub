export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface SparklinePoint {
  date: string;
  value: number;
}

// ── Lead Analytics ──────────────
export interface LeadsBySource {
  source: string;
  count: number;
}

export interface LeadsOverTime {
  date: string;
  count: number;
}

export interface UTMCampaignRow {
  campaign: string;
  leads: number;
  conversions: number;
  conversionRate: number;
}

export interface LeadAnalytics {
  totalLeads: number;
  bySource: LeadsBySource[];
  overTime: LeadsOverTime[];
  byCampaign: UTMCampaignRow[];
  conversionRate: number;
}

// ── Pipeline Analytics ──────────────
export interface PipelineStageMetric {
  stageId: string;
  stageName: string;
  stageColor: string;
  count: number;
  conversionRate: number;
  avgDaysInStage: number;
}

export interface PipelineAnalytics {
  funnelId: string;
  funnelName: string;
  stages: PipelineStageMetric[];
  totalContacts: number;
  overallConversion: number;
}

// ── Communication Analytics ──────────────
export interface CommunicationMetrics {
  waSent: number;
  waDelivered: number;
  waRead: number;
  emailSent: number;
  emailDelivered: number;
  emailOpened: number;
  emailClicked: number;
}

export interface CommunicationByDay {
  date: string;
  waSent: number;
  emailSent: number;
}

export interface CommunicationAnalytics {
  metrics: CommunicationMetrics;
  byDay: CommunicationByDay[];
}

// ── Team Analytics ──────────────
export interface TeamMemberStats {
  memberId: string;
  memberName: string;
  tasksCompleted: number;
  leadsAssigned: number;
  conversions: number;
  revenue: number;
}

export interface TeamAnalytics {
  members: TeamMemberStats[];
  totalTasks: number;
  totalLeads: number;
  totalConversions: number;
  totalRevenue: number;
}

// ── Overview ──────────────
export interface AnalyticsOverview {
  totalLeads: number;
  leadsTrend: SparklinePoint[];
  conversionRate: number;
  conversionTrend: SparklinePoint[];
  totalRevenue: number;
  revenueTrend: SparklinePoint[];
  avgDealSize: number;
  dealSizeTrend: SparklinePoint[];
}
