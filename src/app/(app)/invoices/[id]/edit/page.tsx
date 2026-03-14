import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { parseInvoiceItems } from "@/types/invoices";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [invoiceRes, contactsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company_name")
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
  ]);

  if (invoiceRes.error || !invoiceRes.data) {
    notFound();
  }

  const invoice = invoiceRes.data;

  // Only non-paid/cancelled invoices can be edited
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    redirect(`/invoices/${id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Edit Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Editing {invoice.invoice_number}
        </p>
      </div>
      <InvoiceBuilder
        contacts={contactsRes.data ?? []}
        editInvoice={{
          id: invoice.id,
          contact_id: invoice.contact_id,
          items: parseInvoiceItems(invoice.items),
          gst_number: invoice.gst_number ?? "",
          customer_state: "",
          due_date: invoice.due_date ?? "",
          notes: invoice.notes ?? "",
          gst_rate: invoice.gst_rate ?? 18,
        }}
      />
    </div>
  );
}
