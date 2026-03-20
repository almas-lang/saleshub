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

  // Fetch pending installments for invoices that have them
  const invoiceIdsWithInstallments = rawInvoices
    .filter((i) => i.has_installments)
    .map((i) => i.id);

  let installmentsByInvoice: Record<string, typeof installmentsData> = {};
  let installmentsData: { id: string; invoice_id: string; installment_number: number; amount: number; due_date: string; status: string }[] = [];

  if (invoiceIdsWithInstallments.length > 0) {
    const { data: instData } = await supabase
      .from("installments")
      .select("id, invoice_id, installment_number, amount, due_date, status")
      .in("invoice_id", invoiceIdsWithInstallments)
      .eq("status", "pending")
      .order("due_date", { ascending: true });
    installmentsData = instData ?? [];
  }

  // Group by invoice_id, keep only the next pending one per invoice
  const nextPendingByInvoice: Record<string, { amount: number; due_date: string; installment_number: number }> = {};
  for (const inst of installmentsData) {
    if (!nextPendingByInvoice[inst.invoice_id]) {
      nextPendingByInvoice[inst.invoice_id] = {
        amount: inst.amount,
        due_date: inst.due_date,
        installment_number: inst.installment_number,
      };
    }
  }

  const invoices = rawInvoices.map((inv) => ({
    ...inv,
    _nextInstallment: nextPendingByInvoice[inv.id] ?? null,
  }));

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

  const [outstandingResult, overdueResult, paidResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .in("status", ["sent"])
      .then(({ data: d }) => d?.reduce((sum, i) => sum + i.total, 0) ?? 0),
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "overdue")
      .then(({ data: d }) => d?.reduce((sum, i) => sum + i.total, 0) ?? 0),
    supabase
      .from("invoices")
      .select("total")
      .eq("status", "paid")
      .gte("paid_at", statsMonthStart)
      .lt("paid_at", statsMonthEnd)
      .then(({ data: d }) => d?.reduce((sum, i) => sum + i.total, 0) ?? 0),
  ]);

  return (
    <InvoiceList
      invoices={invoices}
      total={total}
      page={page}
      perPage={perPage}
      totalPages={totalPages}
      currentMonth={month || new Date().toISOString().slice(0, 7)}
      summaryStats={{
        outstanding: outstandingResult,
        overdue: overdueResult,
        paidThisMonth: paidResult,
        paidLabel: month ? `Paid in ${statsMonthLabel}` : "Paid This Month",
      }}
    />
  );
}
