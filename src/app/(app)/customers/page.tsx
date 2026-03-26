import { createClient } from "@/lib/supabase/server";
import { CustomerList } from "@/components/customers/customer-list";
import type { ContactWithStage } from "@/types/contacts";
import type { CustomerProgram } from "@/types/customers";

const ALLOWED_SORT_FIELDS = ["converted_at", "first_name", "totalPaid"] as const;

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
  const sortField = ALLOWED_SORT_FIELDS.includes(params.sort as typeof ALLOWED_SORT_FIELDS[number]) ? params.sort! : "converted_at";
  const sortOrder = params.order === "asc" ? true : false;
  const statusFilter = params.status ?? "all";

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

  // Sort (totalPaid is computed client-side, so fallback to converted_at for DB sort)
  const dbSort = sortField === "totalPaid" ? "converted_at" : sortField;
  query = query.order(dbSort, { ascending: sortOrder, nullsFirst: false }).range(from, to);

  const { data: customers, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch programs and paid invoice totals for all customers
  const contactIds = (customers ?? []).map((c) => c.id);
  const programsMap: Record<string, unknown[]> = {};
  const paidTotalsMap: Record<string, number> = {};

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

  let customersWithPrograms = (customers ?? []).map((c) => ({
    ...c,
    programs: programsMap[c.id] ?? [],
    totalPaid: paidTotalsMap[c.id] ?? 0,
  }));

  // Client-side sort by totalPaid if needed
  if (sortField === "totalPaid") {
    customersWithPrograms.sort((a, b) =>
      sortOrder ? a.totalPaid - b.totalPaid : b.totalPaid - a.totalPaid
    );
  }

  // Filter by program status (client-side since it's a computed field)
  if (statusFilter === "active") {
    customersWithPrograms = customersWithPrograms.filter((c) =>
      (c.programs as CustomerProgram[]).some((p) => p.status === "active")
    );
  } else if (statusFilter === "completed") {
    customersWithPrograms = customersWithPrograms.filter((c) =>
      (c.programs as CustomerProgram[]).every((p) => p.status === "completed") && c.programs.length > 0
    );
  } else if (statusFilter === "no_program") {
    customersWithPrograms = customersWithPrograms.filter((c) => c.programs.length === 0);
  }

  return (
    <CustomerList
      customers={customersWithPrograms as unknown as (ContactWithStage & { programs: CustomerProgram[]; totalPaid: number })[]}
      total={total}
      page={page}
      perPage={perPage}
      totalPages={totalPages}
      currentSort={sortField}
      currentOrder={sortOrder ? "asc" : "desc"}
      currentStatus={statusFilter}
    />
  );
}
