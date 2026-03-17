import type {
  Transaction,
  PnLReport,
  PnLLineItem,
  GSTReport,
  GSTReportRow,
  DateRangeFilter,
} from "@/types/finance";
import { format, parseISO } from "date-fns";

/**
 * Calculate P&L from a list of transactions within a date range.
 */
export function calculatePnL(
  transactions: Transaction[],
  period: DateRangeFilter
): PnLReport {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const t of transactions) {
    const map = t.type === "income" ? incomeMap : expenseMap;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }

  const income: PnLLineItem[] = Array.from(incomeMap, ([category, amount]) => ({
    category,
    amount,
  })).sort((a, b) => b.amount - a.amount);

  const expenses: PnLLineItem[] = Array.from(expenseMap, ([category, amount]) => ({
    category,
    amount,
  })).sort((a, b) => b.amount - a.amount);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    period,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
  };
}

/**
 * Group transactions by category with totals.
 */
export function groupByCategory(
  transactions: Transaction[]
): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(map, ([category, amount]) => ({ category, amount })).sort(
    (a, b) => b.amount - a.amount
  );
}

/**
 * Group transactions by month.
 */
export function groupByMonth(
  transactions: Transaction[]
): { month: string; income: number; expense: number }[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    const month = format(parseISO(t.date), "yyyy-MM");
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    if (t.type === "income") {
      entry.income += t.amount;
    } else {
      entry.expense += t.amount;
    }
    map.set(month, entry);
  }

  return Array.from(map, ([month, data]) => ({ month, ...data })).sort(
    (a, b) => a.month.localeCompare(b.month)
  );
}

/**
 * Calculate GST report from invoices with GST breakup.
 */
export function calculateGSTReport(
  invoices: {
    paid_at: string;
    gst_amount: number;
    customer_state: string | null;
    total: number;
  }[],
  expenseGST: { month: string; gst: number }[],
  period: DateRangeFilter
): GSTReport {
  // Group invoices by month
  const monthMap = new Map<
    string,
    { cgst: number; sgst: number; igst: number }
  >();

  for (const inv of invoices) {
    if (!inv.paid_at) continue;
    const month = format(parseISO(inv.paid_at), "yyyy-MM");
    const entry = monthMap.get(month) ?? { cgst: 0, sgst: 0, igst: 0 };
    const isIntraState =
      !!inv.customer_state &&
      inv.customer_state.toLowerCase().trim() === "karnataka";

    if (isIntraState) {
      const half = Math.round(inv.gst_amount / 2);
      entry.cgst += half;
      entry.sgst += inv.gst_amount - half;
    } else {
      entry.igst += inv.gst_amount;
    }
    monthMap.set(month, entry);
  }

  // Build expense GST map
  const expenseGSTMap = new Map<string, number>();
  for (const e of expenseGST) {
    expenseGSTMap.set(e.month, (expenseGSTMap.get(e.month) ?? 0) + e.gst);
  }

  // Merge all months
  const allMonths = new Set([...monthMap.keys(), ...expenseGSTMap.keys()]);
  const rows: GSTReportRow[] = Array.from(allMonths)
    .sort()
    .map((month) => {
      const output = monthMap.get(month) ?? { cgst: 0, sgst: 0, igst: 0 };
      const inputGST = expenseGSTMap.get(month) ?? 0;
      const totalOutput = output.cgst + output.sgst + output.igst;
      return {
        month,
        outputCGST: output.cgst,
        outputSGST: output.sgst,
        outputIGST: output.igst,
        inputGST,
        netPayable: totalOutput - inputGST,
      };
    });

  const totalOutput = rows.reduce(
    (s, r) => s + r.outputCGST + r.outputSGST + r.outputIGST,
    0
  );
  const totalInput = rows.reduce((s, r) => s + r.inputGST, 0);

  return {
    period,
    rows,
    totalOutput,
    totalInput,
    totalNetPayable: totalOutput - totalInput,
  };
}
