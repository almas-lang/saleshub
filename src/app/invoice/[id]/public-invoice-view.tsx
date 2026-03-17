import { formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceLineItem, GSTBreakup } from "@/types/invoices";

interface PublicInvoiceViewProps {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  clientGst?: string;
  items: InvoiceLineItem[];
  gst: GSTBreakup;
  dueDate?: string;
  notes?: string;
  createdAt?: string;
  status: string;
  paidAt?: string;
}

export function PublicInvoiceView({
  invoiceNumber,
  clientName,
  clientEmail,
  clientPhone,
  clientCompany,
  clientGst,
  items,
  gst,
  dueDate,
  notes,
  createdAt,
}: PublicInvoiceViewProps) {
  const dateStr = createdAt ? formatDate(createdAt) : formatDate(new Date());

  return (
    <div className="rounded-2xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 overflow-hidden">
      {/* Header band */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-wide">EXPWAVE PVT. LTD.</h2>
            <p className="text-slate-400 text-xs mt-1">
              328, 6th Main, AECS B Block, Singasandra, Bangalore 560068
            </p>
            <p className="text-slate-400 text-xs">
              GSTIN: 29AAHCE9805F1ZE &middot; PAN: AAHCE9805F
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">Invoice</p>
            <p className="text-xl font-bold mt-0.5">{invoiceNumber}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Date & Bill To row */}
        <div className="flex gap-8 mb-8">
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-2">Bill To</p>
            <p className="font-semibold text-slate-900">{clientName}</p>
            {clientCompany && <p className="text-sm text-slate-500 mt-0.5">{clientCompany}</p>}
            {clientEmail && <p className="text-sm text-slate-500">{clientEmail}</p>}
            {clientPhone && <p className="text-sm text-slate-500">{clientPhone}</p>}
            {clientGst && <p className="text-sm text-slate-500">GSTIN: {clientGst}</p>}
          </div>
          <div className="text-right">
            <div className="mb-3">
              <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-1">Date</p>
              <p className="text-sm font-medium text-slate-700">{dateStr}</p>
            </div>
            {dueDate && (
              <div>
                <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-1">Due Date</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(dueDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase w-10">#</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Description</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase w-16">Qty</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase w-24">Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-3.5 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3.5 text-slate-800 font-medium">{item.description || "—"}</td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{item.qty}</td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{formatCurrency(item.rate)}</td>
                  <td className="px-4 py-3.5 text-right text-slate-900 font-semibold tabular-nums">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-72">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(gst.subtotal)}</span>
            </div>
            {gst.isIntraState ? (
              <>
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-slate-400">CGST ({gst.gstRate / 2}%)</span>
                  <span className="text-slate-500 tabular-nums">{formatCurrency(gst.cgst)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-slate-400">SGST ({gst.gstRate / 2}%)</span>
                  <span className="text-slate-500 tabular-nums">{formatCurrency(gst.sgst)}</span>
                </div>
              </>
            ) : gst.igst > 0 ? (
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-400">IGST ({gst.gstRate}%)</span>
                <span className="text-slate-500 tabular-nums">{formatCurrency(gst.igst)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center border-t-2 border-slate-900 mt-2 pt-3">
              <span className="text-base font-bold text-slate-900">Total</span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">{formatCurrency(gst.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="mt-8 rounded-lg bg-amber-50 border border-amber-100 px-5 py-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] text-amber-600 uppercase mb-1.5">Notes</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-dashed border-slate-200 my-8" />

        {/* Bank Details + QR Code */}
        <div className="flex justify-between items-start gap-6">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-2.5">Payment Details</p>
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="text-slate-400 w-12 inline-block">Bank</span> HDFC Bank, Halasuru Branch</p>
              <p><span className="text-slate-400 w-12 inline-block">A/c</span> 5020 0090 0123 75</p>
              <p><span className="text-slate-400 w-12 inline-block">IFSC</span> HDFC0000286</p>
              <p><span className="text-slate-400 w-12 inline-block">UPI</span> expwave@ybl</p>
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="rounded-xl border-2 border-slate-100 p-2 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/upi-qr.png" alt="UPI QR" className="size-28 rounded-lg" />
            </div>
            <p className="text-[10px] font-medium text-slate-400 mt-2">Scan to Pay (UPI)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
