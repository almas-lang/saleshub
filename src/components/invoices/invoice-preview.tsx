"use client";

import { formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceLineItem, GSTBreakup } from "@/types/invoices";

interface InvoicePreviewProps {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  clientGst?: string;
  clientState?: string;
  items: InvoiceLineItem[];
  gst: GSTBreakup;
  dueDate?: string;
  notes?: string;
  createdAt?: string;
}

export function InvoicePreview({
  invoiceNumber,
  clientName,
  clientEmail,
  clientPhone,
  clientCompany,
  clientGst,
  clientState,
  items,
  gst,
  dueDate,
  notes,
  createdAt,
}: InvoicePreviewProps) {
  const dateStr = createdAt ? formatDate(createdAt) : formatDate(new Date());

  return (
    <div className="rounded-xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 overflow-hidden text-sm">
      {/* Header band */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wide">EXPWAVE OPC PVT. LTD.</h3>
            <p className="text-slate-400 text-[10px] mt-0.5">
              328, 6th Main, AECS B Block, Singasandra, Bangalore 560068
            </p>
            <p className="text-slate-400 text-[10px]">
              GSTIN: 29AAHCE9805F1ZE &middot; PAN: AAHCE9805F
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold tracking-[0.2em] text-slate-400 uppercase">Invoice</p>
            <p className="text-base font-bold mt-0.5">{invoiceNumber || "XW-XXXX-XXX"}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Date & Bill To row */}
        <div className="flex gap-6 mb-5">
          <div className="flex-1">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-1.5">Bill To</p>
            <p className="font-semibold text-slate-900 text-sm">{clientName || "Select a client"}</p>
            {clientCompany && <p className="text-xs text-slate-500 mt-0.5">{clientCompany}</p>}
            {clientEmail && <p className="text-xs text-slate-500">{clientEmail}</p>}
            {clientPhone && <p className="text-xs text-slate-500">{clientPhone}</p>}
            {clientGst && <p className="text-xs text-slate-500">GSTIN: {clientGst}</p>}
            {clientState && <p className="text-xs text-slate-500">State: {clientState}</p>}
          </div>
          <div className="text-right">
            <div className="mb-2">
              <p className="text-[9px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-0.5">Date</p>
              <p className="text-xs font-medium text-slate-700">{dateStr}</p>
            </div>
            {dueDate && (
              <div>
                <p className="text-[9px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-0.5">Due</p>
                <p className="text-xs font-medium text-slate-700">{formatDate(dueDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase w-8">#</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Description</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase w-12">Qty</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase w-20">Rate</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase w-20">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5 text-slate-800 font-medium">{item.description || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{item.qty}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{formatCurrency(item.rate)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-900 font-semibold tabular-nums">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-3">
          <div className="w-56">
            <div className="flex justify-between py-1.5 text-xs">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(gst.subtotal)}</span>
            </div>
            {gst.isIntraState ? (
              <>
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-slate-400">CGST ({gst.gstRate / 2}%)</span>
                  <span className="text-slate-500 tabular-nums">{formatCurrency(gst.cgst)}</span>
                </div>
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-slate-400">SGST ({gst.gstRate / 2}%)</span>
                  <span className="text-slate-500 tabular-nums">{formatCurrency(gst.sgst)}</span>
                </div>
              </>
            ) : gst.igst > 0 ? (
              <div className="flex justify-between py-1 text-xs">
                <span className="text-slate-400">IGST ({gst.gstRate}%)</span>
                <span className="text-slate-500 tabular-nums">{formatCurrency(gst.igst)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center border-t-2 border-slate-900 mt-1.5 pt-2">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(gst.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="mt-5 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-amber-600 uppercase mb-1">Notes</p>
            <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-dashed border-slate-200 my-5" />

        {/* Bank Details + QR Code */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.15em] text-slate-400 uppercase mb-2">Payment Details</p>
            <div className="text-xs text-slate-600 space-y-0.5">
              <p><span className="text-slate-400">Bank:</span> HDFC Bank, Halasuru Branch</p>
              <p><span className="text-slate-400">A/c:</span> 5020 0090 0123 75</p>
              <p><span className="text-slate-400">IFSC:</span> HDFC0000286</p>
              <p><span className="text-slate-400">UPI:</span> expwave@ybl</p>
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="rounded-lg border border-slate-100 p-1.5 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/upi-qr.png" alt="UPI QR" className="size-24 rounded" />
            </div>
            <p className="text-[9px] font-medium text-slate-400 mt-1.5">Scan to Pay (UPI)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
