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
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type InvoiceWithPending = InvoiceWithContact & {
  _paidAmount: number;
  _balance: number;
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
    paidRevenue: number;
    paidGst: number;
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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => {
    if (currentMonth) return parseInt(currentMonth.split("-")[0]);
    return new Date().getFullYear();
  });

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
          <h1 className="text-xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {total} total
            {currentMonth ? ` · ${new Date(currentMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : " · All time"}
          </p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm">
            <Plus className="mr-1.5 size-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <IndianRupee className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
            <p className="text-lg font-semibold">{formatCurrency(summaryStats.outstanding)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Overdue</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{formatCurrency(summaryStats.overdue)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{summaryStats.paidLabel}</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryStats.paidThisMonth)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-emerald-200/60 pt-3 dark:border-emerald-800/40">
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Revenue</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(summaryStats.paidRevenue)}</p>
            </div>
            <div className="h-6 w-px bg-emerald-200/60 dark:bg-emerald-800/40" />
            <div className="flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">GST</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(summaryStats.paidGst)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-8"
          />
        </div>

        {/* Month Navigator */}
        <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/50 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              const base = currentMonth
                ? new Date(currentMonth + "-01")
                : new Date();
              base.setMonth(base.getMonth() - 1);
              navigateWithParams({ month: base.toISOString().slice(0, 7), page: "1" });
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium hover:text-primary transition-colors"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {currentMonth
                  ? new Date(currentMonth + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                  : "All"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="center">
              {/* Year nav */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setPickerYear((y) => y - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-semibold">{pickerYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setPickerYear((y) => y + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthVal = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                  const isActive = currentMonth === monthVal;
                  const label = new Date(pickerYear, i).toLocaleDateString("en-IN", { month: "short" });
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        navigateWithParams({ month: monthVal, page: "1" });
                        setMonthPickerOpen(false);
                      }}
                      className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* All button */}
              <button
                onClick={() => {
                  navigateWithParams({ month: "", page: "1" });
                  setMonthPickerOpen(false);
                }}
                className={`mt-2 w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  !currentMonth
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-muted"
                }`}
              >
                All Time
              </button>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              const base = currentMonth
                ? new Date(currentMonth + "-01")
                : new Date();
              base.setMonth(base.getMonth() + 1);
              navigateWithParams({ month: base.toISOString().slice(0, 7), page: "1" });
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-1.5 ml-auto">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(f.value)}
              className="rounded-full text-xs px-3 h-7"
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
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium py-3">{inv.invoice_number}</TableCell>
                  <TableCell className="py-3">
                    <div>
                      <span>
                        {inv.contacts
                          ? `${inv.contacts.first_name} ${inv.contacts.last_name ?? ""}`.trim()
                          : "—"}
                      </span>
                      {inv.contacts?.company_name && (
                        <p className="text-xs text-muted-foreground">{inv.contacts.company_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums py-3">
                    {formatCurrency(inv.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3">
                    {inv._paidAmount > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatCurrency(inv._paidAmount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-3">
                    {inv._balance > 0 ? (
                      <span className="font-medium">{formatCurrency(inv._balance)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Paid
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="py-3">
                    {inv._nextInstallment ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-1.5 py-0.5 w-fit">
                        <Clock className="size-3" />
                        {formatCurrency(inv._nextInstallment.amount)} · {formatDate(inv._nextInstallment.due_date)}
                      </span>
                    ) : inv.due_date && inv.status !== "paid" ? (
                      <span className="text-xs text-muted-foreground">{formatDate(inv.due_date)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
