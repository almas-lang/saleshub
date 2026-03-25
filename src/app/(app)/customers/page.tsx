import { createClient } from "@/lib/supabase/server";
import { CustomerList } from "@/components/customers/customer-list";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(params.page ?? "1"));
  const perPage = Math.min(Math.max(parseInt(params.per_page ?? "25"), 10), 100);
  const search = params.search?.trim() ?? "";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("contacts")
    .select(
      "*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)",
      { count: "exact" }
    )
    .eq("type", "customer")
    .is("deleted_at", null);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  query = query.order("converted_at", { ascending: false, nullsFirst: false }).range(from, to);

  const { data: customers, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch programs and paid invoice totals for all customers
  const contactIds = (customers ?? []).map((c) => c.id);
  let programsMap: Record<string, unknown[]> = {};
  let paidTotalsMap: Record<string, number> = {};

  if (contactIds.length > 0) {
    const [{ data: programs }, { data: invoices }] = await Promise.all([
      supabase
        .from("customer_programs")
        .select("*")
        .in("contact_id", contactIds),
      supabase
        .from("invoices")
        .select("contact_id, total")
        .in("contact_id", contactIds)
        .eq("status", "paid"),
    ]);

    if (programs) {
      for (const p of programs) {
        if (!programsMap[p.contact_id]) programsMap[p.contact_id] = [];
        programsMap[p.contact_id].push(p);
      }
    }

    if (invoices) {
      for (const inv of invoices) {
        paidTotalsMap[inv.contact_id] = (paidTotalsMap[inv.contact_id] ?? 0) + inv.total;
      }
    }
  }

  const customersWithPrograms = (customers ?? []).map((c) => ({
    ...c,
    programs: programsMap[c.id] ?? [],
    totalPaid: paidTotalsMap[c.id] ?? 0,
  }));

  return (
    <CustomerList
      customers={customersWithPrograms as any}
      total={total}
      page={page}
      perPage={perPage}
      totalPages={totalPages}
    />
  );
}
