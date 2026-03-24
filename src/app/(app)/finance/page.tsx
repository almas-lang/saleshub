import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { groupByCategory, groupByMonth } from "@/lib/finance/calculations";
import { FinanceOverview } from "@/components/finance/finance-overview";
import { FinanceNav } from "@/components/finance/finance-nav";
import type { FinanceSummary, Transaction } from "@/types/finance";

export default async function FinancePage() {
  const supabase = await createClient();

  const now = new Date();
  const fyStart =
    now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);

  const fyStartStr = format(fyStart, "yyyy-MM-dd");

  const [expenseTransactionsRes, paidInvoicesRes, recentRes] = await Promise.all([
    // Only expense transactions — avoids double-counting invoice income transactions
    supabase
      .from("transactions")
      .select("*")
      .eq("type", "expense")
      .gte("date", fyStartStr)
      .order("date", { ascending: true }),
    // Paid invoices are the authoritative revenue source
    supabase
      .from("invoices")
      .select("id, total, paid_at, contact_id")
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .gte("paid_at", fyStart.toISOString()),
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(8),
  ]);

  const expenses = (expenseTransactionsRes.data ?? []) as Transaction[];
  const paidInvoices = paidInvoicesRes.data ?? [];
  const recentTransactions = (recentRes.data ?? []) as Transaction[];

  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Build synthetic income transactions from paid invoices for the chart
  const syntheticIncome: Transaction[] = paidInvoices
    .filter((i) => i.paid_at)
    .map((i) => ({
      id: i.id,
      type: "income" as const,
      amount: i.total ?? 0,
      date: i.paid_at!.split("T")[0],
      category: "Invoice Payment",
      description: null,
      invoice_id: i.id,
      contact_id: i.contact_id ?? null,
      gst_applicable: null,
      receipt_url: null,
      created_at: i.paid_at!,
      updated_at: i.paid_at!,
    }));

  const revenueByMonth = groupByMonth([...syntheticIncome, ...expenses]);
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
