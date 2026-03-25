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
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { safeFetch } from "@/lib/fetch";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceWithContact } from "@/types/invoices";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type InvoiceWithPending = InvoiceWithContact & {
  _paidAmount: number;
  _balance: number;
  _nextInstallment?: {
    amount: number;
    due_date: string;
    installment_number: number;
    reminder_date: string;
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

const PER_PAGE_OPTIONS = [10, 25, 50];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function InvoiceList({
  invoices,
  total,
  page,
  perPage,
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);

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

  const deleteInvoice = invoices.find((i) => i.id === deleteId);
  const markPaidInvoice = invoices.find((i) => i.id === markPaidId);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              {total} total
              {currentMonth
                ? ` · ${new Date(currentMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
                : " · All time"}
            </p>
          </div>
          <Link href="/invoices/new">
            <Button size="sm">
              <Plus className="mr-1.5 size-4" />
              New Invoice
            </Button>
          </Link>
        </div>

        {/* Summary Stats — KPI Card Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Outstanding"
            value={summaryStats.outstanding}
            index={0}
          />
          <StatCard
            label="Overdue"
            value={summaryStats.overdue}
            danger={summaryStats.overdue > 0}
            index={1}
          />
          <StatCard
            label={summaryStats.paidLabel}
            value={summaryStats.paidThisMonth}
            index={2}
          >
            <div className="mt-3 flex items-center gap-3 border-t pt-3">
              <div className="flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Revenue
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(summaryStats.paidRevenue)}
                </p>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  GST
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(summaryStats.paidGst)}
                </p>
              </div>
            </div>
          </StatCard>
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
                navigateWithParams({
                  month: base.toISOString().slice(0, 7),
                  page: "1",
                });
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium hover:text-primary transition-colors">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  {currentMonth
                    ? new Date(currentMonth + "-01").toLocaleDateString(
                        "en-IN",
                        { month: "short", year: "numeric" }
                      )
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
                    const label = new Date(pickerYear, i).toLocaleDateString(
                      "en-IN",
                      { month: "short" }
                    );
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
                navigateWithParams({
                  month: base.toISOString().slice(0, 7),
                  page: "1",
                });
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

        {/* Table — Desktop */}
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
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block rounded-lg border">
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
                    <TableHead>Reminder</TableHead>
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
                      <TableCell className="font-medium py-3">
                        {inv.invoice_number}
                        {inv.type === "estimate" && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                          >
                            EST
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <div>
                          <span>
                            {inv.contacts
                              ? `${inv.contacts.first_name} ${inv.contacts.last_name ?? ""}`.trim()
                              : "—"}
                          </span>
                          {inv.contacts?.company_name && (
                            <p className="text-xs text-muted-foreground">
                              {inv.contacts.company_name}
                            </p>
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
                          <span className="font-medium">
                            {formatCurrency(inv._balance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Paid
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {inv._nextInstallment ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                                Partial
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Paid {formatCurrency(inv._paidAmount)} of{" "}
                              {formatCurrency(inv.total)}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <InvoiceStatusBadge status={inv.status} />
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {inv._nextInstallment ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-1.5 py-0.5 w-fit">
                                <Clock className="size-3" />
                                {formatCurrency(inv._nextInstallment.amount)}{" "}
                                &middot;{" "}
                                {formatDate(inv._nextInstallment.due_date)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Installment #{inv._nextInstallment.installment_number}:{" "}
                              {formatCurrency(inv._nextInstallment.amount)} due on{" "}
                              {new Date(inv._nextInstallment.due_date + "T00:00:00").toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </TooltipContent>
                          </Tooltip>
                        ) : inv.due_date && inv.status !== "paid" ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(inv.due_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {inv._nextInstallment
                          ? (() => {
                              const reminderDate = new Date(
                                inv._nextInstallment.reminder_date + "T00:00:00"
                              );
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const isPast = reminderDate < today;
                              const isToday =
                                reminderDate.getTime() === today.getTime();
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 w-fit ${
                                        isToday
                                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                                          : isPast
                                            ? "text-muted-foreground"
                                            : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      <Bell className="size-3" />
                                      {isToday
                                        ? "Today"
                                        : formatDate(
                                            inv._nextInstallment.reminder_date
                                          )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isToday
                                      ? "Reminder is due today"
                                      : isPast
                                        ? "Reminder was sent"
                                        : `Reminder on ${new Date(inv._nextInstallment.reminder_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" })}`}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()
                          : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <InvoiceRowActions
                          inv={inv}
                          onView={() => router.push(`/invoices/${inv.id}`)}
                          onEdit={() => router.push(`/invoices/${inv.id}/edit`)}
                          onSend={() => handleSend(inv.id)}
                          onMarkPaid={() => setMarkPaidId(inv.id)}
                          onDelete={() => setDeleteId(inv.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="flex flex-col gap-2 lg:hidden">
              {invoices.map((inv) => {
                const clientName = inv.contacts
                  ? `${inv.contacts.first_name} ${inv.contacts.last_name ?? ""}`.trim()
                  : "—";
                return (
                  <div
                    key={inv.id}
                    className="rounded-xl border bg-card p-3 cursor-pointer active:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {inv.invoice_number}
                          </span>
                          {inv.type === "estimate" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground shrink-0"
                            >
                              EST
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {clientName}
                          {inv.contacts?.company_name &&
                            ` · ${inv.contacts.company_name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inv._nextInstallment ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                            Partial
                          </span>
                        ) : (
                          <InvoiceStatusBadge status={inv.status} />
                        )}
                        <div onClick={(e) => e.stopPropagation()}>
                          <InvoiceRowActions
                            inv={inv}
                            onView={() => router.push(`/invoices/${inv.id}`)}
                            onEdit={() =>
                              router.push(`/invoices/${inv.id}/edit`)
                            }
                            onSend={() => handleSend(inv.id)}
                            onMarkPaid={() => setMarkPaidId(inv.id)}
                            onDelete={() => setDeleteId(inv.id)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(inv.total)}
                      </span>
                      {inv._balance > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Balance: {formatCurrency(inv._balance)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          Paid
                        </span>
                      )}
                    </div>
                    {inv._nextInstallment && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                        Next: {formatCurrency(inv._nextInstallment.amount)}{" "}
                        &middot; {formatDate(inv._nextInstallment.due_date)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination — Desktop */}
        {totalPages > 1 && (
          <div className="hidden items-center justify-between lg:flex">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–
              {Math.min(page * perPage, total)} of {total} invoice
              {total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(perPage)}
                onValueChange={(v) =>
                  navigateWithParams({ per_page: v, page: "1" })
                }
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">/ page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => navigateWithParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-1 text-sm text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="size-8 p-0 text-xs"
                    onClick={() => navigateWithParams({ page: String(p) })}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => navigateWithParams({ page: String(page + 1) })}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Pagination — Mobile */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
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

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Delete Invoice"
          description={`Permanently delete invoice ${deleteInvoice?.invoice_number ?? ""}? This action cannot be undone.`}
          onConfirm={() => {
            if (deleteId) handleDelete(deleteId);
            setDeleteId(null);
          }}
          destructive
        />
        <ConfirmDialog
          open={!!markPaidId}
          onOpenChange={(open) => !open && setMarkPaidId(null)}
          title="Mark as Paid"
          description={`Mark invoice ${markPaidInvoice?.invoice_number ?? ""} (${formatCurrency(markPaidInvoice?.total ?? 0)}) as fully paid?`}
          onConfirm={() => {
            if (markPaidId) handleMarkPaid(markPaidId);
            setMarkPaidId(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared dropdown actions (used in both desktop and mobile)          */
/* ------------------------------------------------------------------ */
function InvoiceRowActions({
  inv,
  onView,
  onEdit,
  onSend,
  onMarkPaid,
  onDelete,
}: {
  inv: InvoiceWithPending;
  onView: () => void;
  onEdit: () => void;
  onSend: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 size-3.5" />
          View
        </DropdownMenuItem>
        {inv.status !== "paid" && inv.status !== "cancelled" && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 size-3.5" />
            Edit
          </DropdownMenuItem>
        )}
        {inv.status === "draft" && (
          <DropdownMenuItem onClick={onSend}>
            <Send className="mr-2 size-3.5" />
            Send
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a
            href={`/api/invoices/${inv.id}/pdf`}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="mr-2 size-3.5" />
            Preview PDF
          </a>
        </DropdownMenuItem>
        {inv.status !== "paid" && inv.status !== "cancelled" && (
          <DropdownMenuItem onClick={onMarkPaid}>
            <CheckCircle2 className="mr-2 size-3.5" />
            Mark Paid
          </DropdownMenuItem>
        )}
        {inv.status !== "paid" && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 size-3.5" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
