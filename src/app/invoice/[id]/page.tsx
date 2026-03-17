import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
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

  const isPaid = invoice.status === "paid";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Top bar */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              XW
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Xperience Wave</p>
              <p className="text-xs text-slate-500">
                {invoice.invoice_number}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.payment_link && !isPaid && (
              <a
                href={invoice.payment_link}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700 transition-colors"
              >
                Pay {formatCurrency(invoice.total)}
              </a>
            )}
            <a
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="mr-1.5 size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              PDF
            </a>
          </div>
        </div>
      </div>

      {/* Invoice card */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        {isPaid && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3.5">
            <svg className="size-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-medium text-emerald-800">
              Payment received{invoice.paid_at ? ` — Thank you!` : ""}
            </p>
          </div>
        )}

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

        <p className="text-center text-xs text-slate-400 mt-8">
          Expwave Pvt. Ltd. &middot; GSTIN: 29AAHCE9805F1ZE
        </p>
      </div>
    </div>
  );
}
