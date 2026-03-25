"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Receipt,
  TrendingDown,
  Calculator,
  CalendarDays,
  MoreHorizontal,
  X,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ExportDropdown } from "@/components/shared/export-dropdown";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseCategoryBadge } from "./expense-category-badge";
import { ExpenseForm } from "./expense-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useExport } from "@/hooks/use-export";
import Link from "next/link";
import type { Transaction } from "@/types/finance";

interface ExpenseListProps {
  expenses: (Transaction & {
    contacts: { id: string; first_name: string; last_name: string | null } | null;
  })[];
  total: number;
  summary: {
    totalAmount: number;
    count: number;
    thisMonthTotal: number;
    gstTotal: number;
  };
  categories: string[];
}

export function ExpenseList({
  expenses: initialExpenses,
  total,
  summary,
  categories,
}: ExpenseListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { exportData, loading: exporting } = useExport({
    type: "expenses",
    filters: {
      ...(categoryFilter !== "all" && { category: categoryFilter }),
      ...(dateRange?.from && { from: format(dateRange.from, "yyyy-MM-dd") }),
      ...(dateRange?.to && { to: format(dateRange.to, "yyyy-MM-dd") }),
    },
  });

  // Client-side filtering
  const filtered = initialExpenses.filter((exp) => {
    if (search) {
      const q = search.toLowerCase();
      const matchDesc = exp.description?.toLowerCase().includes(q);
      const matchCat = exp.category.toLowerCase().includes(q);
      if (!matchDesc && !matchCat) return false;
    }
    if (categoryFilter !== "all" && exp.category !== categoryFilter) return false;
    if (dateRange?.from && exp.date < format(dateRange.from, "yyyy-MM-dd")) return false;
    if (dateRange?.to && exp.date > format(dateRange.to, "yyyy-MM-dd")) return false;
    return true;
  });

  const hasActiveFilters = search || categoryFilter !== "all" || dateRange;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/transactions/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Expense deleted");
      setDeleteId(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete expense");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDateRange(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {total} transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/finance/import">
              <Upload className="mr-1.5 size-4" />
              Import Statement
            </Link>
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 size-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Expenses" value={summary.totalAmount} color="red" index={0} />
        <StatCard label="This Month" value={summary.thisMonthTotal} color="amber" index={1} />
        <StatCard label="Input GST" value={summary.gstTotal} color="blue" index={2} />
        <StatCard
          label="Average"
          value={summary.count > 0 ? Math.round(summary.totalAmount / summary.count) : 0}
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportDropdown onExport={exportData} loading={exporting} />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-2 text-xs text-muted-foreground"
          >
            <X className="mr-1 size-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasActiveFilters ? "No matching expenses" : "No expenses yet"}
          description={
            hasActiveFilters
              ? "Try adjusting your filters to find what you're looking for."
              : "Start tracking your business expenses by adding your first entry."
          }
          action={
            hasActiveFilters
              ? { label: "Clear Filters", onClick: clearFilters }
              : { label: "Add Expense", onClick: () => setShowForm(true) }
          }
        />
      ) : (
        <>
        {/* Desktop Table */}
        <div className="hidden lg:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[60px]">GST</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((exp) => (
                <TableRow key={exp.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {format(new Date(exp.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <ExpenseCategoryBadge category={exp.category} />
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm">
                    {exp.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {formatCurrency(exp.amount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {exp.gst_applicable ? "18%" : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditItem(exp);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(exp.id)}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-2 lg:hidden">
          {filtered.map((exp) => (
            <div key={exp.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {exp.description || exp.category}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ExpenseCategoryBadge category={exp.category} />
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(exp.date), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-sm font-semibold">
                    {formatCurrency(exp.amount)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditItem(exp);
                          setShowForm(true);
                        }}
                      >
                        <Pencil className="mr-2 size-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Showing count when filtered */}
      {hasActiveFilters && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {total} expenses
        </p>
      )}

      {/* Forms/Dialogs */}
      <ExpenseForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditItem(null);
        }}
        editData={
          editItem
            ? {
                id: editItem.id,
                amount: editItem.amount,
                category: editItem.category,
                date: editItem.date,
                description: editItem.description,
                gst_applicable: editItem.gst_applicable,
                receipt_url: editItem.receipt_url,
                contact_id: editItem.contact_id,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete Expense"
        description="This expense will be permanently deleted. This action cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
