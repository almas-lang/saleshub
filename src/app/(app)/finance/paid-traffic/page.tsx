import { format, startOfMonth, endOfMonth, parseISO, subMonths } from "date-fns";
import { FinanceNav } from "@/components/finance/finance-nav";
import { PaidTrafficTable } from "@/components/finance/paid-traffic-table";
import {
  getPaidTrafficData,
  computeTotals,
} from "@/lib/analytics/paid-traffic-queries";

export default async function PaidTrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;

  // Default to current month
  const now = new Date();
  const monthDate = monthParam
    ? parseISO(`${monthParam}-01`)
    : startOfMonth(now);

  const from = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const to = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const rows = await getPaidTrafficData(from, to, "meta");
  const totals = computeTotals(rows);

  // Generate last 6 months for tabs
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMM yyyy"),
    };
  });

  const currentMonth = format(monthDate, "yyyy-MM");

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Daily paid traffic performance across the full funnel.
        </p>
      </div>

      <FinanceNav />

      <PaidTrafficTable
        rows={rows}
        totals={totals}
        months={months}
        currentMonth={currentMonth}
      />
    </div>
  );
}
