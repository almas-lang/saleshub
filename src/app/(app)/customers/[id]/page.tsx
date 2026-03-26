import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";
import type { InvoiceWithContact } from "@/types/invoices";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch customer (contact with type = customer)
  const { data: customer, error } = await supabase
    .from("contacts")
    .select("*, funnel_stages(id, name, color), funnels(id, name), team_members(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !customer) {
    notFound();
  }

  // Fetch programs, invoices, and activities in parallel
  const [programsResult, invoicesResult, activitiesResult] = await Promise.all([
    supabase
      .from("customer_programs")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("id, type, title, body, created_at")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const programs = programsResult.data ?? [];
  const invoices = (invoicesResult.data ?? []) as InvoiceWithContact[];
  const activities = activitiesResult.data ?? [];
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <CustomerDetail
      customer={customer as any}
      programs={programs}
      invoices={invoices}
      totalPaid={totalPaid}
      activities={activities}
    />
  );
}
