"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { RevenueExpenseChart } from "./revenue-expense-chart";
import { ExpensePieChart } from "./expense-pie-chart";
import type { FinanceSummary } from "@/types/finance";

const CATEGORY_COLORS: Record<string, string> = {
  "Advertising": "#EF4444",
  "Software & Tools": "#3B82F6",
  "Freelancers & Contractors": "#8B5CF6",
  "Content Production": "#F59E0B",
  "Office & Supplies": "#6B7280",
  "Travel & Events": "#14B8A6",
  "Communication (Phone/Internet)": "#06B6D4",
  "Training & Education": "#EC4899",
  "Taxes & Compliance": "#84CC16",
  "Miscellaneous": "#9CA3AF",
};

interface FinanceOverviewProps {
  summary: FinanceSummary;
}

export function FinanceOverview({ summary }: FinanceOverviewProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={summary.totalRevenue}
          color="emerald"
          index={0}
        />
        <StatCard
          label="Total Expenses"
          value={summary.totalExpenses}
          color="red"
          index={1}
        />
        <StatCard
          label="Net Profit"
          value={Math.abs(summary.netProfit)}
          color={summary.netProfit >= 0 ? "emerald" : "red"}
          danger={summary.netProfit < 0}
          index={2}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-medium">Revenue vs Expenses</h3>
          <RevenueExpenseChart data={summary.revenueByMonth} />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-medium">Expense Breakdown</h3>
          <ExpensePieChart
            data={summary.expensesByCategory.map((e) => ({
              ...e,
              color: CATEGORY_COLORS[e.category] ?? "#6B7280",
            }))}
          />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-sm font-medium">Recent Transactions</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/expenses">
              View all <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
        <div className="divide-y">
          {summary.recentTransactions.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              No transactions yet
            </p>
          ) : (
            summary.recentTransactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {t.description || t.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} &middot; {formatDate(t.date)}
                  </p>
                </div>
                <p
                  className={cn(
                    "font-mono text-sm font-medium",
                    t.type === "income" ? "text-emerald-600" : "text-red-500"
                  )}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
