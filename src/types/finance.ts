import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/types";

// ── Transaction types (from Supabase) ──────────────
export type Transaction = Tables<"transactions">;
export type TransactionInsert = TablesInsert<"transactions">;
export type TransactionUpdate = TablesUpdate<"transactions">;
export type TransactionType = Enums<"transaction_type">;

// ── Expense Category (new table — needs SQL migration) ──────────────
export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  created_at: string;
}

// ── Ad Spend (new table — needs SQL migration) ──────────────
export type AdSpendPlatform = "meta" | "google" | "linkedin" | "manual";

export interface AdSpend {
  id: string;
  platform: AdSpendPlatform;
  campaign_name: string;
  campaign_id: string | null;
  date: string;
  amount: number;
  impressions: number;
  clicks: number;
  leads: number;
  spend_currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type AdSpendInsert = Omit<AdSpend, "id" | "created_at" | "updated_at">;

// ── Report types ──────────────

export interface DateRangeFilter {
  from: string; // ISO date
  to: string;   // ISO date
}

export interface PnLLineItem {
  category: string;
  amount: number;
}

export interface PnLReport {
  period: DateRangeFilter;
  income: PnLLineItem[];
  expenses: PnLLineItem[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface GSTReportRow {
  month: string;
  outputCGST: number;
  outputSGST: number;
  outputIGST: number;
  inputGST: number;
  netPayable: number;
}

export interface GSTReport {
  period: DateRangeFilter;
  rows: GSTReportRow[];
  totalOutput: number;
  totalInput: number;
  totalNetPayable: number;
}

export interface RevenueByMonth {
  month: string;
  amount: number;
}

export interface RevenueByContact {
  contactId: string;
  contactName: string;
  amount: number;
}

export interface RevenueReport {
  period: DateRangeFilter;
  byMonth: RevenueByMonth[];
  byContact: RevenueByContact[];
  total: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueByMonth: { month: string; income: number; expense: number }[];
  expensesByCategory: { category: string; amount: number }[];
  recentTransactions: Transaction[];
}
