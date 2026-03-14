import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calculateGST } from "@/lib/invoices/gst";
import { parseInvoiceItems } from "@/types/invoices";
import { PublicInvoiceView } from "./public-invoice-view";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*, contacts(id, first_name, last_name, email, phone, company_name)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    notFound();
  }

  const items = parseInvoiceItems(invoice.items);
  const contact = invoice.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
    : "Unknown";
  const gst = calculateGST(items, null, invoice.gst_rate ?? 18);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Expwave OPC Pvt. Ltd.</p>
            <p className="text-xs text-muted-foreground">
              Invoice {invoice.invoice_number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.payment_link && invoice.status !== "paid" && (
              <a
                href={invoice.payment_link}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Pay Now — {formatCurrency(invoice.total)}
              </a>
            )}
            <a
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* Invoice preview */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PublicInvoiceView
          invoiceNumber={invoice.invoice_number}
          clientName={clientName}
          clientEmail={contact?.email ?? undefined}
          clientPhone={contact?.phone ?? undefined}
          clientCompany={contact?.company_name ?? undefined}
          clientGst={invoice.gst_number ?? undefined}
          items={items}
          gst={gst}
          dueDate={invoice.due_date ?? undefined}
          notes={invoice.notes ?? undefined}
          createdAt={invoice.created_at}
          status={invoice.status}
          paidAt={invoice.paid_at ?? undefined}
        />
      </div>
    </div>
  );
}
