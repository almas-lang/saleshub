import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import type { InvoiceWithContact } from "@/types/invoices";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [invoiceResult, installmentsResult, teamMembersResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, contacts(id, first_name, last_name, email, phone, company_name, type)")
      .eq("id", id)
      .single(),
    supabase
      .from("installments")
      .select("*")
      .eq("invoice_id", id)
      .order("installment_number", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (invoiceResult.error || !invoiceResult.data) {
    notFound();
  }

  const invoice = {
    ...invoiceResult.data,
    installments: installmentsResult.data ?? [],
  } as InvoiceWithContact;

  return <InvoiceDetail invoice={invoice} teamMembers={teamMembersResult.data ?? []} />;
}
