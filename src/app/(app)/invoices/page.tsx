import { createClient } from "@/lib/supabase/server";
import { InvoiceList } from "@/components/invoices/invoice-list";
import type { InvoiceWithContact } from "@/types/invoices";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = 25;
  const status = params.status ?? "";
  const search = params.search?.trim() ?? "";
  const month = params.month ?? ""; // format: YYYY-MM

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("invoices")
    .select(
      "*, contacts(id, first_name, last_name, email, phone, company_name)",
      { count: "exact" }
    );

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.ilike("invoice_number", `%${search}%`);
  }

  // Filter by month if selected
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1).toISOString();
    const monthEnd = new Date(y, m, 1).toISOString();
    query = query.gte("created_at", monthStart).lt("created_at", monthEnd);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count } = await query;

  const rawInvoices = (data ?? []) as InvoiceWithContact[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch all installments for invoices that have them
  const invoiceIdsWithInstallments = rawInvoices
    .filter((i) => i.has_installments)
    .map((i) => i.id);

  let allInstallmentsData: { id: string; invoice_id: string; installment_number: number; amount: number; due_date: string; status: string }[] = [];

  if (invoiceIdsWithInstallments.length > 0) {
    const { data: instData } = await supabase
      .from("installments")
      .select("id, invoice_id, installment_number, amount, due_date, status")
      .in("invoice_id", invoiceIdsWithInstallments)
      .order("due_date", { ascending: true });
    allInstallmentsData = instData ?? [];
  }

  // Group installments by invoice: compute paid amount, pending balance, next pending
  const paidByInvoice: Record<string, number> = {};
  const pendingByInvoice: Record<string, number> = {};
  const nextPendingByInvoice: Record<string, { amount: number; due_date: string; installment_number: number; reminder_date: string }> = {};
  for (const inst of allInstallmentsData) {
    if (inst.status === "paid") {
      paidByInvoice[inst.invoice_id] = (paidByInvoice[inst.invoice_id] ?? 0) + Number(inst.amount);
    }
    if (inst.status === "pending") {
      pendingByInvoice[inst.invoice_id] = (pendingByInvoice[inst.invoice_id] ?? 0) + Number(inst.amount);
      if (!nextPendingByInvoice[inst.invoice_id]) {
        // Reminder is sent 2 days before due date
        const dueDate = new Date(inst.due_date + "T00:00:00");
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - 2);
        nextPendingByInvoice[inst.invoice_id] = {
          amount: Number(inst.amount),
          due_date: inst.due_date,
          installment_number: inst.installment_number,
          reminder_date: reminderDate.toISOString().split("T")[0],
        };
      }
    }
  }

  const invoices = rawInvoices.map((inv) => {
    const isInstallment = inv.has_installments;
    const paidAmount = isInstallment
      ? (paidByInvoice[inv.id] ?? 0)
      : inv.status === "paid" ? inv.total : 0;
    // For installment invoices, balance = actual pending installment sum
    // (more accurate than total - paid, handles mismatches between invoice status and installments)
    const balance = isInstallment
      ? (pendingByInvoice[inv.id] ?? 0)
      : Math.max(inv.total - paidAmount, 0);
    return {
      ...inv,
      _paidAmount: paidAmount,
      _balance: balance,
      _nextInstallment: nextPendingByInvoice[inv.id] ?? null,
    };
  });

  // Calculate summary stats for the selected month (or current month)
  const now = new Date();
  let statsMonthStart: string;
  let statsMonthEnd: string;
  let statsMonthLabel: string;

  if (month) {
    const [y, m] = month.split("-").map(Number);
    statsMonthStart = new Date(y, m - 1, 1).toISOString();
    statsMonthEnd = new Date(y, m, 1).toISOString();
    statsMonthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } else {
    statsMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    statsMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    statsMonthLabel = "This Month";
  }

  // For outstanding/overdue: fetch invoices + their pending installment amounts
  // so partial payments are deducted correctly
  const [sentInvoicesData, overdueInvoicesData, pendingInstallmentsForStats, paidInvoicesData, paidInstallmentsData] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, total, has_installments")
      .eq("status", "sent"),
    supabase
      .from("invoices")
      .select("id, total, has_installments")
      .eq("status", "overdue"),
    // Pending installments for all sent/overdue invoices (to deduct paid amounts)
    supabase
      .from("installments")
      .select("invoice_id, amount")
      .eq("status", "pending"),
    // Fully paid invoices this month (non-installment) — fetch subtotal + total
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("status", "paid")
      .eq("has_installments", false)
      .gte("paid_at", statsMonthStart)
      .lt("paid_at", statsMonthEnd)
      .then(({ data: d }) => d ?? []),
    // Paid installments this month — join parent invoice for tax ratio
    supabase
      .from("installments")
      .select("amount, invoice_id")
      .eq("status", "paid")
      .gte("paid_at", statsMonthStart)
      .lt("paid_at", statsMonthEnd)
      .then(({ data: d }) => d ?? []),
  ]);

  // Build pending installments map: invoice_id -> sum of pending amounts
  const pendingAmountByInvoice: Record<string, number> = {};
  for (const inst of pendingInstallmentsForStats.data ?? []) {
    pendingAmountByInvoice[inst.invoice_id] = (pendingAmountByInvoice[inst.invoice_id] ?? 0) + Number(inst.amount);
  }

  // Outstanding = ALL pending installment amounts (regardless of invoice status)
  // + full total of sent/overdue invoices that have no installments
  const allPendingInstallmentsTotal = (pendingInstallmentsForStats.data ?? [])
    .reduce((sum, inst) => sum + Number(inst.amount), 0);

  const nonInstallmentSentTotal = (sentInvoicesData.data ?? [])
    .filter((inv) => !inv.has_installments)
    .reduce((sum, inv) => sum + inv.total, 0);

  const outstandingResult = allPendingInstallmentsTotal + nonInstallmentSentTotal;

  // Overdue = non-installment overdue invoices + pending installments on overdue invoices
  // (installment invoices that are overdue are already captured in allPendingInstallmentsTotal
  //  via the global pending installments query above, so only add non-installment overdue here)
  const overdueResult = (overdueInvoicesData.data ?? []).reduce((sum, inv) => {
    const amount = inv.has_installments
      ? (pendingAmountByInvoice[inv.id] ?? 0)
      : inv.total;
    return sum + amount;
  }, 0);

  // Compute revenue / GST / cash collected from fully paid invoices
  let paidRevenue = 0;
  let paidGst = 0;
  let paidCash = 0;
  for (const inv of paidInvoicesData) {
    paidCash += inv.total;
    paidRevenue += inv.subtotal;
    paidGst += inv.total - inv.subtotal;
  }

  // For installment payments, fetch parent invoice subtotal/total to derive tax ratio
  const instInvoiceIds = [...new Set(paidInstallmentsData.map((i) => i.invoice_id))];
  let invoiceTaxMap: Record<string, { subtotal: number; total: number }> = {};
  if (instInvoiceIds.length > 0) {
    const { data: parentInvs } = await supabase
      .from("invoices")
      .select("id, subtotal, total")
      .in("id", instInvoiceIds);
    for (const p of parentInvs ?? []) {
      invoiceTaxMap[p.id] = { subtotal: p.subtotal, total: p.total };
    }
  }

  for (const inst of paidInstallmentsData) {
    const amount = Number(inst.amount);
    const parent = invoiceTaxMap[inst.invoice_id];
    if (parent && parent.total > 0) {
      const taxRatio = (parent.total - parent.subtotal) / parent.total;
      const instGst = amount * taxRatio;
      paidGst += instGst;
      paidRevenue += amount - instGst;
    } else {
      paidRevenue += amount;
    }
    paidCash += amount;
  }

  return (
    <InvoiceList
      invoices={invoices}
      total={total}
      page={page}
      perPage={perPage}
      totalPages={totalPages}
      currentMonth={month}
      summaryStats={{
        outstanding: outstandingResult,
        overdue: overdueResult,
        paidThisMonth: paidCash,
        paidRevenue,
        paidGst,
        paidLabel: month ? `Paid in ${statsMonthLabel}` : "Paid This Month",
      }}
    />
  );
}
