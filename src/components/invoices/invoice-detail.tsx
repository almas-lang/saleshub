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
  Trash2,
  Clock,
  CircleCheck,
  CircleAlert,
  CalendarIcon,
  SplitSquareHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { formatDate, formatCurrency } from "@/lib/utils";
import { calculateGST } from "@/lib/invoices/gst";
import type { InvoiceWithContact, Installment } from "@/types/invoices";
import { parseInvoiceItems } from "@/types/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";

interface InvoiceDetailProps {
  invoice: InvoiceWithContact;
}

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [paidDate, setPaidDate] = useState<Date>(new Date());
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installmentOpen, setInstallmentOpen] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);
  const [installmentRows, setInstallmentRows] = useState<
    { amount: number; due_date: string; status: "pending" | "paid" }[]
  >([]);

  const items = parseInvoiceItems(invoice.items);

  const gst = calculateGST(items, null, invoice.gst_rate ?? 18);
  const contact = invoice.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name ?? ""}`.trim()
    : "Unknown";

  async function handleSend() {
    setSending(true);
    setSendDialogOpen(false);
    const result = await safeFetch<{
      payment_link_included?: boolean;
      payment_link_error?: string;
    }>(`/api/invoices/${invoice.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ include_payment_link: includePaymentLink }),
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (includePaymentLink && !result.data.payment_link_included) {
      toast.warning(
        `Invoice sent, but payment link failed: ${result.data.payment_link_error ?? "unknown error"}`,
        { duration: 8000 }
      );
    } else {
      toast.success("Invoice sent successfully");
    }
    router.refresh();
  }

  async function handleMarkPaid() {
    const result = await safeFetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", paid_at: paidDate.toISOString() }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice marked as paid");
    setMarkPaidOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const result = await safeFetch(`/api/invoices/${invoice.id}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice deleted");
    router.push("/invoices");
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

  function initInstallments(count: number) {
    const perInst = Math.floor(invoice.total / count);
    const remainder = Math.round((invoice.total - perInst * count) * 100) / 100;
    const today = new Date();
    const rows = Array.from({ length: count }, (_, i) => {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 30 * (i + 1));
      return {
        amount: i === count - 1 ? perInst + remainder : perInst,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending" as const,
      };
    });
    setInstallmentRows(rows);
  }

  function openInstallmentDialog() {
    setInstallmentCount(2);
    initInstallments(2);
    setInstallmentOpen(true);
  }

  async function handleAddInstallments() {
    const total = installmentRows.reduce((s, r) => s + r.amount, 0);
    if (total <= 0) {
      toast.error("Installment amounts must be greater than zero");
      return;
    }

    const payload = {
      installments: installmentRows.map((r, i) => ({
        installment_number: i + 1,
        ...r,
        paid_at: r.status === "paid" ? new Date().toISOString() : undefined,
      })),
    };

    const result = await safeFetch(`/api/invoices/${invoice.id}/installments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to add installments");
      return;
    }

    toast.success("Installments added");
    setInstallmentOpen(false);
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
          {!invoice.has_installments && (
            <Button
              variant="outline"
              size="sm"
              onClick={openInstallmentDialog}
            >
              <SplitSquareHorizontal className="mr-1.5 size-3.5" />
              Add Installments
            </Button>
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
          {invoice.status !== "paid" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
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

          {invoice.has_installments && invoice.installments && invoice.installments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Payment Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoice.installments.map((inst: Installment) => {
                  const isPaid = inst.status === "paid";
                  const isOverdue = inst.status === "overdue" || (!isPaid && inst.status === "pending" && new Date(inst.due_date) < new Date());
                  return (
                    <div key={inst.id} className="flex items-start gap-2 text-sm">
                      {isPaid ? (
                        <CircleCheck className="mt-0.5 size-4 text-emerald-500 shrink-0" />
                      ) : isOverdue ? (
                        <CircleAlert className="mt-0.5 size-4 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="mt-0.5 size-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <span className="font-medium">#{inst.installment_number}</span>
                          <span className="font-medium">{formatCurrency(inst.amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Due {formatDate(inst.due_date)}</span>
                          <span className={isPaid ? "text-emerald-600" : isOverdue ? "text-red-600" : ""}>
                            {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
                          </span>
                        </div>
                      </div>
                      {!isPaid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs shrink-0"
                          onClick={() => {
                            const link = `${window.location.origin}/pay/${invoice.id}?inst=${inst.id}`;
                            navigator.clipboard.writeText(link);
                            toast.success("Pay link copied");
                          }}
                        >
                          <Copy className="size-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
      <AlertDialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Paid</AlertDialogTitle>
            <AlertDialogDescription>
              Mark invoice {invoice.invoice_number} ({formatCurrency(invoice.total)}) as paid?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-sm">Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paidDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {paidDate ? format(paidDate, "dd MMM yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidDate}
                  onSelect={(date) => date && setPaidDate(date)}
                  disabled={(date) => date > new Date()}
                  defaultMonth={paidDate}
                />
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid}>
              <CheckCircle2 className="mr-1.5 size-3.5" />
              Mark Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Invoice"
        description={`Permanently delete invoice ${invoice.invoice_number}? This action cannot be undone.`}
        onConfirm={handleDelete}
      />

      {/* Add Installments Dialog */}
      <AlertDialog open={installmentOpen} onOpenChange={setInstallmentOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Installments</AlertDialogTitle>
            <AlertDialogDescription>
              Split {invoice.invoice_number} into installments. Enter the full program amount
              across all installments. Mark past payments as &quot;Paid&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            {/* Count selector */}
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Number of installments</Label>
              <div className="flex gap-1">
                {[2, 3, 4].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={installmentCount === n ? "default" : "outline"}
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setInstallmentCount(n);
                      initInstallments(n);
                    }}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            {/* Installment rows */}
            <div className="space-y-3">
              {installmentRows.map((row, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Installment #{i + 1}</span>
                    <Button
                      size="sm"
                      variant={row.status === "paid" ? "default" : "outline"}
                      className={cn(
                        "h-6 text-xs",
                        row.status === "paid" && "bg-emerald-600 hover:bg-emerald-700"
                      )}
                      onClick={() => {
                        const updated = [...installmentRows];
                        updated[i] = {
                          ...updated[i],
                          status: updated[i].status === "paid" ? "pending" : "paid",
                        };
                        setInstallmentRows(updated);
                      }}
                    >
                      {row.status === "paid" ? "Paid" : "Pending"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => {
                          const updated = [...installmentRows];
                          updated[i] = { ...updated[i], amount: parseFloat(e.target.value) || 0 };
                          setInstallmentRows(updated);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Due Date</Label>
                      <Input
                        type="date"
                        value={row.due_date}
                        onChange={(e) => {
                          const updated = [...installmentRows];
                          updated[i] = { ...updated[i], due_date: e.target.value };
                          setInstallmentRows(updated);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total summary */}
            {(() => {
              const total = installmentRows.reduce((s, r) => s + r.amount, 0);
              const paidTotal = installmentRows
                .filter((r) => r.status === "paid")
                .reduce((s, r) => s + r.amount, 0);
              const pendingTotal = total - paidTotal;
              return (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>
                  {paidTotal > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Already paid</span>
                      <span>{formatCurrency(paidTotal)}</span>
                    </div>
                  )}
                  {pendingTotal > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Remaining</span>
                      <span>{formatCurrency(pendingTotal)}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddInstallments}>
              <SplitSquareHorizontal className="mr-1.5 size-3.5" />
              Save Installments
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
