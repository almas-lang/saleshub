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

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count } = await query;

  const invoices = (data ?? []) as InvoiceWithContact[];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Calculate summary stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
      .gte("paid_at", monthStart)
      .then(({ data: d }) => d?.reduce((sum, i) => sum + i.total, 0) ?? 0),
  ]);

  return (
    <InvoiceList
      invoices={invoices}
      total={total}
      page={page}
      perPage={perPage}
      totalPages={totalPages}
      summaryStats={{
        outstanding: outstandingResult,
        overdue: overdueResult,
        paidThisMonth: paidResult,
      }}
    />
  );
}
