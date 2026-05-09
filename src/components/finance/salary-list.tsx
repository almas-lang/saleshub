"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  FileText,
  Users,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/utils";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SalaryPaymentForm } from "./salary-payment-form";
import type { SalaryPayment } from "@/types/finance";

interface SalaryListProps {
  payments: SalaryPayment[];
  total: number;
  currentMonth: string;
  summary: {
    totalAmount: number;
    thisMonthTotal: number;
    employeeCount: number;
  };
}

export function SalaryList({ payments, total, currentMonth, summary }: SalaryListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => {
    if (currentMonth) return parseInt(currentMonth.split("-")[0]);
    return new Date().getFullYear();
  });

  function navigateMonth(month: string) {
    const params = new URLSearchParams(window.location.search);
    if (month) params.set("month", month);
    else params.delete("month");
    router.push(`/finance/salaries?${params.toString()}`);
  }
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SalaryPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.employee_name.toLowerCase().includes(q) ||
      p.employee_number.toLowerCase().includes(q) ||
      (p.notes?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/finance/salary-payments/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Payment deleted");
      setDeleteId(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete payment");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Salary Payments
          </h2>
          <p className="text-sm text-muted-foreground">
            {total} payment{total !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Paid"
          value={summary.totalAmount}
          index={0}
        />
        <StatCard
          label="This Month"
          value={summary.thisMonthTotal}
          color="amber"
          index={1}
        />
        <StatCard
          label="Employees"
          value={summary.employeeCount}
          format="number"
          index={2}
        />
      </div>

      {/* Search + Month Navigator */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
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
              navigateMonth(base.toISOString().slice(0, 7));
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium hover:text-primary transition-colors">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {currentMonth
                  ? new Date(currentMonth + "-01").toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })
                  : "All"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="center">
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
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthVal = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                  const isActive = currentMonth === monthVal;
                  const label = new Date(pickerYear, i).toLocaleDateString("en-IN", { month: "short" });
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        navigateMonth(monthVal);
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
              <button
                onClick={() => {
                  navigateMonth("");
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
              navigateMonth(base.toISOString().slice(0, 7));
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matching payments" : "No salary payments yet"}
          description={
            search
              ? "Try a different search term."
              : "Record your first salary payment to get started."
          }
          action={
            search
              ? undefined
              : { label: "Add Payment", onClick: () => setShowForm(true) }
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {p.employee_number}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {format(new Date(p.paid_date + "T00:00:00"), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.payment_mode ?? "UPI"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {p.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`/api/finance/salary-payments/${p.id}/receipt`}
                              target="_blank"
                              rel="noopener"
                            >
                              <FileText className="mr-2 size-3.5" />
                              Download Receipt
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditItem(p);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="mr-2 size-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(p.id)}
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
            {filtered.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.employee_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {p.employee_number}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(p.paid_date + "T00:00:00"), "dd MMM yyyy")}
                      </span>
                    </div>
                    {p.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {p.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-sm font-semibold">
                      {formatCurrency(p.amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a
                            href={`/api/finance/salary-payments/${p.id}/receipt`}
                            target="_blank"
                            rel="noopener"
                          >
                            <FileText className="mr-2 size-3.5" />
                            Download Receipt
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditItem(p);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(p.id)}
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

      {/* Forms/Dialogs */}
      <SalaryPaymentForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditItem(null);
        }}
        editData={
          editItem
            ? {
                id: editItem.id,
                employee_name: editItem.employee_name,
                employee_number: editItem.employee_number,
                amount: editItem.amount,
                paid_date: editItem.paid_date,
                payment_mode: editItem.payment_mode,
                notes: editItem.notes,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete Payment"
        description="This salary payment will be permanently deleted. This action cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
