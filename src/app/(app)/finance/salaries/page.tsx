import { createClient } from "@/lib/supabase/server";
import { SalaryList } from "@/components/finance/salary-list";
import { FinanceNav } from "@/components/finance/finance-nav";

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const month = params.month ?? ""; // YYYY-MM

  let query = supabase
    .from("salary_payments")
    .select("*", { count: "exact" })
    .order("paid_date", { ascending: false });

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("paid_date", from).lte("paid_date", to);
  } else {
    query = query.limit(100);
  }

  const { data: payments, count } = await query;
  const rows = payments ?? [];
  const totalAmount = rows.reduce((s, p) => s + p.amount, 0);

  // Current/selected month total
  const now = new Date();
  const statsMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthTotal = rows
    .filter((p) => p.paid_date.startsWith(statsMonth))
    .reduce((s, p) => s + p.amount, 0);

  const employeeCount = new Set(rows.map((p) => p.employee_number)).size;

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage salary payments and generate receipts.
        </p>
      </div>

      <FinanceNav />

      <SalaryList
        payments={rows}
        total={count ?? 0}
        currentMonth={month}
        summary={{
          totalAmount,
          thisMonthTotal,
          employeeCount,
        }}
      />
    </div>
  );
}
