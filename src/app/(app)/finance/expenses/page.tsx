import { createClient } from "@/lib/supabase/server";
import { ExpenseList } from "@/components/finance/expense-list";
import { FinanceNav } from "@/components/finance/finance-nav";

export default async function ExpensesPage() {
  const supabase = await createClient();

  const { data: expenses, count } = await supabase
    .from("transactions")
    .select("*, contacts(id, first_name, last_name)", { count: "exact" })
    .eq("type", "expense")
    .order("date", { ascending: false })
    .limit(50);

  const rows = expenses ?? [];
  const totalAmount = rows.reduce((s, e) => s + e.amount, 0);

  // Current month expenses
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisMonthTotal = rows
    .filter((e) => e.date >= monthStart)
    .reduce((s, e) => s + e.amount, 0);

  // GST total from applicable expenses
  const gstTotal = rows
    .filter((e) => e.gst_applicable)
    .reduce((s, e) => s + Math.round(e.amount * 0.18), 0);

  // Get unique categories from expenses
  const categories = [...new Set(rows.map((e) => e.category))].sort();

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Track and manage all business expenses.
        </p>
      </div>

      <FinanceNav />

      <ExpenseList
        expenses={rows}
        total={count ?? 0}
        summary={{
          totalAmount,
          count: count ?? 0,
          thisMonthTotal,
          gstTotal,
        }}
        categories={categories}
      />
    </div>
  );
}
