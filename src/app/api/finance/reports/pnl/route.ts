import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePnL } from "@/lib/finance/calculations";
import type { Transaction } from "@/types/finance";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;

  const from = sp.get("from");
  const to = sp.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to dates required" },
      { status: 400 }
    );
  }

  // Fetch expense transactions AND paid invoices + installments for income
  const [expensesRes, paidInvoicesRes, paidInstallmentsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("type", "expense")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true }),
    // Paid invoices (non-installment) as authoritative income source
    supabase
      .from("invoices")
      .select("id, total, paid_at, contact_id")
      .eq("status", "paid")
      .eq("has_installments", false)
      .not("paid_at", "is", null)
      .gte("paid_at", `${from}T00:00:00`)
      .lte("paid_at", `${to}T23:59:59`),
    // Paid installments in the date range
    supabase
      .from("installments")
      .select("amount, paid_at, invoice_id")
      .eq("status", "paid")
      .gte("paid_at", `${from}T00:00:00`)
      .lte("paid_at", `${to}T23:59:59`),
  ]);

  if (expensesRes.error) {
    return NextResponse.json({ error: expensesRes.error.message }, { status: 500 });
  }

  const expenses = (expensesRes.data ?? []) as Transaction[];
  const paidInvoices = paidInvoicesRes.data ?? [];
  const paidInstallments = paidInstallmentsRes.data ?? [];

  // Build synthetic income transactions from paid invoices
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

  // Build synthetic income from paid installments
  const installmentIncome: Transaction[] = paidInstallments
    .filter((i) => i.paid_at)
    .map((i, idx) => ({
      id: `inst-${idx}`,
      type: "income" as const,
      amount: Number(i.amount) || 0,
      date: i.paid_at!.split("T")[0],
      category: "Invoice Payment",
      description: null,
      invoice_id: i.invoice_id ?? null,
      contact_id: null,
      gst_applicable: null,
      receipt_url: null,
      created_at: i.paid_at!,
      updated_at: i.paid_at!,
    }));

  const allTransactions = [...syntheticIncome, ...installmentIncome, ...expenses];
  const report = calculatePnL(allTransactions, { from, to });
  return NextResponse.json(report);
}
