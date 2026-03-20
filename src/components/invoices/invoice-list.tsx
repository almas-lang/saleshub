"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  Send,
  Eye,
  Pencil,
  CheckCircle2,
  MoreHorizontal,
  Receipt,
  FileText,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceWithContact, InvoiceStatus } from "@/types/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type InvoiceWithPending = InvoiceWithContact & {
  _nextInstallment?: {
    amount: number;
    due_date: string;
    installment_number: number;
  } | null;
};

interface InvoiceListProps {
  invoices: InvoiceWithPending[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  currentMonth: string;
  summaryStats: {
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
    paidLabel: string;
  };
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

export function InvoiceList({
  invoices,
  total,
  page,
  totalPages,
  currentMonth,
  summaryStats,
}: InvoiceListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  function navigateWithParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(overrides)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/invoices?${params.toString()}`);
  }

  function handleSearch() {
    navigateWithParams({ search, page: "1" });
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status);
    navigateWithParams({ status: status === "all" ? "" : status, page: "1" });
  }

  async function handleMarkPaid(id: string) {
    const result = await safeFetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice marked as paid");
    router.refresh();
  }

  async function handleSend(id: string) {
    const result = await safeFetch(`/api/invoices/${id}/send`, {
      method: "POST",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice sent");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const result = await safeFetch(`/api/invoices/${id}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice deleted");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-semibold">{formatCurrency(summaryStats.outstanding)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-lg font-semibold text-red-600">{formatCurrency(summaryStats.overdue)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{summaryStats.paidLabel}</p>
          <p className="text-lg font-semibold text-emerald-600">{formatCurrency(summaryStats.paidThisMonth)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-8"
          />
        </div>
        <Input
          type="month"
          value={currentMonth}
          onChange={(e) => navigateWithParams({ month: e.target.value, page: "1" })}
          className="w-40 text-xs"
        />
        {currentMonth !== new Date().toISOString().slice(0, 7) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => navigateWithParams({ month: "", page: "1" })}
          >
            Reset
          </Button>
        )}
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(f.value)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Create your first invoice to get started."
          action={{
            label: "New Invoice",
            onClick: () => router.push("/invoices/new"),
          }}
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    {inv.contacts
                      ? `${inv.contacts.first_name} ${inv.contacts.last_name ?? ""}`.trim()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(inv.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <InvoiceStatusBadge status={inv.status} />
                      {inv._nextInstallment && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600">
                          <Clock className="size-3" />
                          #{inv._nextInstallment.installment_number} {formatCurrency(inv._nextInstallment.amount)} due {formatDate(inv._nextInstallment.due_date)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(inv.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.due_date ? formatDate(inv.due_date) : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                          <Eye className="mr-2 size-3.5" />
                          View
                        </DropdownMenuItem>
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}/edit`)}>
                            <Pencil className="mr-2 size-3.5" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {inv.status === "draft" && (
                          <DropdownMenuItem onClick={() => handleSend(inv.id)}>
                            <Send className="mr-2 size-3.5" />
                            Send
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                            <FileText className="mr-2 size-3.5" />
                            Preview PDF
                          </a>
                        </DropdownMenuItem>
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleMarkPaid(inv.id)}>
                            <CheckCircle2 className="mr-2 size-3.5" />
                            Mark Paid
                          </DropdownMenuItem>
                        )}
                        {inv.status !== "paid" && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(inv.id)}
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigateWithParams({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigateWithParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
