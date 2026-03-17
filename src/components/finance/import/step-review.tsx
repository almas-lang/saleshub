"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseCategoryBadge } from "@/components/finance/expense-category-badge";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/bank-import-utils";
import type { ParsedBankRow } from "@/lib/bank-import-utils";

type Filter = "all" | "income" | "expense" | "uncategorized" | "errors";

interface StepReviewProps {
  rows: ParsedBankRow[];
  onRowsChange: (rows: ParsedBankRow[]) => void;
}

export function StepReview({ rows, onRowsChange }: StepReviewProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const summary = useMemo(() => {
    const income = rows.filter((r) => r.type === "income" && !r.error);
    const expenses = rows.filter((r) => r.type === "expense" && !r.error);
    const errors = rows.filter((r) => !!r.error);
    const uncategorized = rows.filter((r) => r.category === "Uncategorized" && !r.error);
    return {
      incomeCount: income.length,
      incomeTotal: income.reduce((s, r) => s + r.amount, 0),
      expenseCount: expenses.length,
      expenseTotal: expenses.reduce((s, r) => s + r.amount, 0),
      errorCount: errors.length,
      uncategorizedCount: uncategorized.length,
      selectedCount: rows.filter((r) => r.selected).length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .map((r, i) => ({ ...r, _index: i }))
      .filter((r) => {
        if (filter === "income") return r.type === "income" && !r.error;
        if (filter === "expense") return r.type === "expense" && !r.error;
        if (filter === "uncategorized") return r.category === "Uncategorized" && !r.error;
        if (filter === "errors") return !!r.error;
        return true;
      });
  }, [rows, filter]);

  const toggleRow = (index: number) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    onRowsChange(updated);
  };

  const toggleAll = () => {
    const validRows = rows.filter((r) => !r.error);
    const allSelected = validRows.every((r) => r.selected);
    const updated = rows.map((r) =>
      r.error ? r : { ...r, selected: !allSelected }
    );
    onRowsChange(updated);
  };

  const updateCategory = (index: number, category: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], category };
    onRowsChange(updated);
  };

  const allValidSelected = rows.filter((r) => !r.error).every((r) => r.selected);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-medium">Review & Categorize</h2>
        <p className="text-sm text-muted-foreground">
          Review parsed transactions, fix categories, and select which ones to import.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setFilter("income")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "income" ? "border-primary bg-primary/5" : "bg-card"}`}
        >
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="mt-1 font-mono text-sm font-semibold text-green-600">
            {summary.incomeCount} txns &middot; {formatCurrency(summary.incomeTotal)}
          </p>
        </button>
        <button
          onClick={() => setFilter("expense")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "expense" ? "border-primary bg-primary/5" : "bg-card"}`}
        >
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="mt-1 font-mono text-sm font-semibold text-red-600">
            {summary.expenseCount} txns &middot; {formatCurrency(summary.expenseTotal)}
          </p>
        </button>
        <button
          onClick={() => setFilter("uncategorized")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "uncategorized" ? "border-primary bg-primary/5" : "bg-card"}`}
        >
          <p className="text-xs text-muted-foreground">Uncategorized</p>
          <p className="mt-1 font-mono text-sm font-semibold text-amber-600">
            {summary.uncategorizedCount}
          </p>
        </button>
        <button
          onClick={() => setFilter(filter === "errors" ? "all" : "errors")}
          className={`rounded-lg border p-3 text-left transition-colors ${filter === "errors" ? "border-primary bg-primary/5" : "bg-card"}`}
        >
          <p className="text-xs text-muted-foreground">Errors</p>
          <p className="mt-1 font-mono text-sm font-semibold text-destructive">
            {summary.errorCount}
          </p>
        </button>
      </div>

      {filter !== "all" && (
        <button
          onClick={() => setFilter("all")}
          className="text-xs text-primary hover:underline"
        >
          Show all {rows.length} rows
        </button>
      )}

      {/* Table */}
      <div className="max-h-[500px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allValidSelected}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead className="w-[110px] text-right">Amount</TableHead>
              <TableHead className="w-[200px]">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow
                key={row._index}
                className={row.error ? "bg-destructive/5" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={row.selected}
                    disabled={!!row.error}
                    onCheckedChange={() => toggleRow(row._index)}
                  />
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  {row.date
                    ? format(new Date(row.date), "dd MMM yy")
                    : "—"
                  }
                </TableCell>
                <TableCell className="max-w-[250px] truncate text-xs" title={row.description}>
                  <div className="flex items-center gap-1.5">
                    {row.error && (
                      <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                    )}
                    {row.description || "—"}
                  </div>
                  {row.error && (
                    <p className="text-[10px] text-destructive">{row.error}</p>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      row.type === "income"
                        ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                        : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                    }`}
                  >
                    {row.type}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell>
                  {row.error ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Select
                      value={row.category}
                      onValueChange={(val) => updateCategory(row._index, val)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>
                          <ExpenseCategoryBadge category={row.category} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {row.type === "expense" ? (
                          EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))
                        ) : (
                          INCOME_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {summary.selectedCount} of {rows.length} transactions selected for import
      </p>
    </div>
  );
}
