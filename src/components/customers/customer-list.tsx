"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ContactWithStage } from "@/types/contacts";
import type { CustomerProgram } from "@/types/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";

interface CustomerWithPrograms extends ContactWithStage {
  programs: CustomerProgram[];
  totalPaid: number;
}

interface CustomerListProps {
  customers: CustomerWithPrograms[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  currentSort?: string;
  currentOrder?: string;
  currentStatus?: string;
}

const PER_PAGE_OPTIONS = [10, 25, 50];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function CustomerList({
  customers,
  total,
  page,
  perPage,
  totalPages,
  currentSort = "converted_at",
  currentOrder = "desc",
  currentStatus = "all",
}: CustomerListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  function navigateWithParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(overrides)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/customers?${params.toString()}`);
  }

  function handleSearch() {
    navigateWithParams({ search, page: "1" });
  }

  // Compute summary stats
  const activeCount = customers.filter((c) =>
    c.programs?.some((p) => p.status === "active")
  ).length;
  const completedCount = customers.filter((c) =>
    c.programs?.some((p) => p.status === "completed")
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Customers" value={total} format="number" index={0} />
        <StatCard label="Active Programs" value={activeCount} format="number" color="emerald" index={1} />
        <StatCard label="Completed Programs" value={completedCount} format="number" color="blue" index={2} />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select
          value={currentStatus}
          onValueChange={(v) =>
            navigateWithParams({ status: v === "all" ? "" : v, page: "1" })
          }
        >
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active Program</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_program">No Program</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table — Desktop */}
      {customers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No customers yet"
          description="Convert prospects to customers when they sign up for a program."
        />
      ) : (
        <>
          <div className="hidden lg:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() =>
                        navigateWithParams({
                          sort: "first_name",
                          order: currentSort === "first_name" && currentOrder === "asc" ? "desc" : "asc",
                          page: "1",
                        })
                      }
                    >
                      Name
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() =>
                        navigateWithParams({
                          sort: "converted_at",
                          order: currentSort === "converted_at" && currentOrder === "desc" ? "asc" : "desc",
                          page: "1",
                        })
                      }
                    >
                      Start Date
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="text-right">
                    <button
                      className="ml-auto flex items-center gap-1 hover:text-foreground"
                      onClick={() =>
                        navigateWithParams({
                          sort: "totalPaid",
                          order: currentSort === "totalPaid" && currentOrder === "desc" ? "asc" : "desc",
                          page: "1",
                        })
                      }
                    >
                      Total Paid
                      <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const activeProgram = customer.programs?.[0];
                  const progress =
                    activeProgram?.sessions_total && activeProgram.sessions_total > 0
                      ? Math.round(
                          ((activeProgram.sessions_completed ?? 0) /
                            activeProgram.sessions_total) *
                            100
                        )
                      : 0;
                  return (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {customer.first_name} {customer.last_name ?? ""}
                          </p>
                          {customer.email && (
                            <p className="text-xs text-muted-foreground">
                              {customer.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {activeProgram ? (
                          <Badge variant="outline" className="text-xs">
                            {activeProgram.program_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {activeProgram?.status ? (
                          <Badge
                            variant="outline"
                            className={
                              activeProgram.status === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : activeProgram.status === "completed"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                            }
                          >
                            {activeProgram.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {activeProgram?.start_date
                          ? formatDate(activeProgram.start_date)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {activeProgram?.sessions_total ? (
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 w-16" />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {activeProgram.sessions_completed ?? 0}/
                              {activeProgram.sessions_total}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {customer.totalPaid > 0
                          ? formatCurrency(customer.totalPaid)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col gap-2 lg:hidden">
            {customers.map((customer) => {
              const activeProgram = customer.programs?.[0];
              const progress =
                activeProgram?.sessions_total && activeProgram.sessions_total > 0
                  ? Math.round(
                      ((activeProgram.sessions_completed ?? 0) /
                        activeProgram.sessions_total) *
                        100
                    )
                  : 0;
              return (
                <div
                  key={customer.id}
                  className="rounded-xl border bg-card p-3 cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/customers/${customer.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {customer.first_name} {customer.last_name ?? ""}
                      </p>
                      {customer.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.email}
                        </p>
                      )}
                    </div>
                    {activeProgram?.status && (
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${
                          activeProgram.status === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {activeProgram.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {activeProgram && (
                        <Badge variant="outline" className="text-[10px]">
                          {activeProgram.program_name}
                        </Badge>
                      )}
                      {activeProgram?.sessions_total ? (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {activeProgram.sessions_completed ?? 0}/
                          {activeProgram.sessions_total} sessions
                        </span>
                      ) : null}
                    </div>
                    {customer.totalPaid > 0 && (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(customer.totalPaid)}
                      </span>
                    )}
                  </div>
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
            {Math.min(page * perPage, total)} of {total} customer
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
    </div>
  );
}
