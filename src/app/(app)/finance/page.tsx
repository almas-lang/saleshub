import { createClient } from "@/lib/supabase/server";
import { startOfMonth, subMonths, format } from "date-fns";
import { groupByCategory, groupByMonth } from "@/lib/finance/calculations";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { FinanceNav } from "@/components/finance/finance-nav";
import type { FinanceSummary, Transaction } from "@/types/finance";

export default async function FinancePage() {
  const supabase = await createClient();

  // Fetch all transactions for the current financial year
  const now = new Date();
  const fyStart =
    now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

  const [transactionsRes, recentRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", format(fyStart, "yyyy-MM-dd"))
      .order("date", { ascending: true }),
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(8),
  ]);

  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const recentTransactions = (recentRes.data ?? []) as Transaction[];

  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalRevenue = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const revenueByMonth = groupByMonth(transactions);
  const expensesByCategory = groupByCategory(expenses);

  const summary: FinanceSummary = {
    totalRevenue,
    totalExpenses,
    netProfit,
    revenueByMonth,
    expensesByCategory,
    recentTransactions,
  };

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Financial overview for the current year.
        </p>
      </div>

      <FinanceNav />

      <FinanceOverview summary={summary} />
    </div>
  );
}
