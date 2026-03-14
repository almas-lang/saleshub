import { formatDate, formatCurrency } from "@/lib/utils";
import { BUSINESS_STATE, BUSINESS_STATE_CODE } from "@/lib/invoices/gst";
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
  status,
  paidAt,
}: PublicInvoiceViewProps) {
  const dateStr = createdAt ? formatDate(createdAt) : formatDate(new Date());

  return (
    <div className="rounded-lg border bg-white p-8 shadow-sm">
      {/* Paid stamp */}
      {status === "paid" && (
        <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700 font-medium">
          Paid{paidAt ? ` on ${formatDate(paidAt)}` : ""} — Thank you!
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-primary">EXPWAVE OPC PVT. LTD.</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            328, 6th main AECS B Block Singasandra Bangalore 560068
          </p>
          <p className="text-xs text-muted-foreground">
            GSTIN: 29AAHCE9805F1ZE | PAN: AAHCE9805F
          </p>
          <p className="text-xs text-muted-foreground">
            State: {BUSINESS_STATE} ({BUSINESS_STATE_CODE})
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">INVOICE</p>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-medium">{invoiceNumber}</span>
          </p>
          <p className="text-xs text-muted-foreground">Date: {dateStr}</p>
          {dueDate && (
            <p className="text-xs text-muted-foreground">
              Due: {formatDate(dueDate)}
            </p>
          )}
        </div>
      </div>

      {/* Bill To */}
      <div className="mt-6 rounded bg-muted/50 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">BILL TO</p>
        <p className="font-medium text-base">{clientName}</p>
        {clientCompany && <p className="text-sm text-muted-foreground">{clientCompany}</p>}
        {clientEmail && <p className="text-sm text-muted-foreground">{clientEmail}</p>}
        {clientPhone && <p className="text-sm text-muted-foreground">{clientPhone}</p>}
        {clientGst && <p className="text-sm text-muted-foreground">GSTIN: {clientGst}</p>}
      </div>

      {/* Items Table */}
      <div className="mt-6">
        <div className="grid grid-cols-12 gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Rate</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 py-3 border-b border-dashed text-sm">
            <div className="col-span-1 text-muted-foreground">{i + 1}</div>
            <div className="col-span-5">{item.description || "—"}</div>
            <div className="col-span-2 text-right">{item.qty}</div>
            <div className="col-span-2 text-right">{formatCurrency(item.rate)}</div>
            <div className="col-span-2 text-right font-medium">{formatCurrency(item.amount)}</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(gst.subtotal)}</span>
          </div>
          {gst.isIntraState ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST ({gst.gstRate / 2}%)</span>
                <span>{formatCurrency(gst.cgst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST ({gst.gstRate / 2}%)</span>
                <span>{formatCurrency(gst.sgst)}</span>
              </div>
            </>
          ) : gst.igst > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST ({gst.gstRate}%)</span>
              <span>{formatCurrency(gst.igst)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(gst.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="mt-6 rounded bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">NOTES</p>
          <p className="text-sm whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {/* Bank Details + QR Code */}
      <div className="mt-6 border-t pt-4 flex justify-between items-start">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">BANK DETAILS</p>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p>Bank: HDFC Bank, Halasuru Branch</p>
            <p>A/c No: 5020 0090 0123 75</p>
            <p>IFSC: HDFC0000286</p>
            <p>UPI: expwave@ybl</p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/upi-qr.png" alt="UPI QR" className="size-32 rounded" />
          <p className="text-[10px] text-muted-foreground mt-1">Scan to Pay (UPI)</p>
        </div>
      </div>
    </div>
  );
}
