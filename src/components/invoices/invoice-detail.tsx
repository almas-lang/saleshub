"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Send,
  CheckCircle2,
  Link as LinkIcon,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { formatDate, formatCurrency } from "@/lib/utils";
import { calculateGST } from "@/lib/invoices/gst";
import type { InvoiceWithContact } from "@/types/invoices";
import { parseInvoiceItems } from "@/types/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoicePreview } from "./invoice-preview";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface InvoiceDetailProps {
  invoice: InvoiceWithContact;
}

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const items = parseInvoiceItems(invoice.items);

  const gst = calculateGST(items, null, invoice.gst_rate ?? 18);
  const contact = invoice.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
    : "Unknown";

  async function handleSend() {
    setSending(true);
    setSendDialogOpen(false);
    const result = await safeFetch(`/api/invoices/${invoice.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ include_payment_link: includePaymentLink }),
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice sent successfully");
    router.refresh();
  }

  async function handleMarkPaid() {
    const result = await safeFetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice marked as paid");
    setMarkPaidOpen(false);
    router.refresh();
  }

  async function handleGeneratePaymentLink(gateway: "cashfree" | "stripe") {
    setGeneratingLink(true);
    const result = await safeFetch<{ payment_link: string }>(
      `/api/invoices/${invoice.id}/payment-link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      }
    );
    setGeneratingLink(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.payment_link) {
      await navigator.clipboard.writeText(result.data.payment_link);
      toast.success("Payment link copied to clipboard");
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{invoice.invoice_number}</h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {clientName} &middot; {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Button size="sm" onClick={() => setSendDialogOpen(true)} disabled={sending}>
              <Send className="mr-1.5 size-3.5" />
              {sending ? "Sending..." : "Send Invoice"}
            </Button>
          )}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGeneratePaymentLink("cashfree")}
                disabled={generatingLink}
              >
                <LinkIcon className="mr-1.5 size-3.5" />
                Payment Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkPaidOpen(true)}
              >
                <CheckCircle2 className="mr-1.5 size-3.5" />
                Mark Paid
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener">
              <Eye className="mr-1.5 size-3.5" />
              Preview PDF
            </a>
          </Button>
          {invoice.payment_link && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(invoice.payment_link!);
                toast.success("Payment link copied");
              }}
            >
              <Copy className="mr-1.5 size-3.5" />
              Copy Link
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Preview */}
        <div className="lg:col-span-2">
          <InvoicePreview
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
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(invoice.created_at)}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
              )}
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid On</span>
                  <span className="text-emerald-600">{formatDate(invoice.paid_at)}</span>
                </div>
              )}
              {invoice.payment_gateway && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="capitalize">{invoice.payment_gateway}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {contact && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Link
                  href={`/prospects/${contact.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {clientName}
                </Link>
                {contact.email && (
                  <p className="text-muted-foreground">{contact.email}</p>
                )}
                {contact.phone && (
                  <p className="text-muted-foreground">{contact.phone}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Send Invoice Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Send {invoice.invoice_number} ({formatCurrency(invoice.total)}) to{" "}
              {contact?.email ?? "client"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="include-payment-link"
              checked={includePaymentLink}
              onCheckedChange={(checked) => setIncludePaymentLink(checked === true)}
            />
            <Label htmlFor="include-payment-link" className="text-sm font-normal cursor-pointer">
              Include payment link (Cashfree)
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>
              <Send className="mr-1.5 size-3.5" />
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Paid Confirmation */}
      <ConfirmDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        title="Mark as Paid"
        description={`Mark invoice ${invoice.invoice_number} (${formatCurrency(invoice.total)}) as paid? This will update the invoice status.`}
        onConfirm={handleMarkPaid}
      />
    </div>
  );
}
