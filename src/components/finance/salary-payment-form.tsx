"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { salaryPaymentSchema, type SalaryPaymentValues } from "@/lib/validations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAYMENT_MODES = ["UPI", "Bank Transfer", "Cash", "Cheque", "Credit Card"];

interface Employee {
  id: string;
  name: string;
  employee_number: string;
  role: string | null;
}

interface SalaryPaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    employee_name: string;
    employee_number: string;
    amount: number;
    paid_date: string;
    payment_mode: string | null;
    notes: string | null;
  };
}

export function SalaryPaymentForm({
  open,
  onOpenChange,
  editData,
}: SalaryPaymentFormProps) {
  const router = useRouter();
  const isEdit = !!editData;
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Fetch employees on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/finance/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d.data ?? []))
      .catch(() => {});
  }, [open]);

  const form = useForm<SalaryPaymentValues>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: editData
      ? {
          employee_name: editData.employee_name,
          employee_number: editData.employee_number,
          amount: editData.amount,
          paid_date: editData.paid_date,
          payment_mode: editData.payment_mode ?? "UPI",
          notes: editData.notes ?? "",
        }
      : {
          employee_name: "",
          employee_number: "",
          amount: 0,
          paid_date: new Date().toISOString().split("T")[0],
          payment_mode: "UPI",
          notes: "",
        },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    form.reset(
      editData
        ? {
            employee_name: editData.employee_name,
            employee_number: editData.employee_number,
            amount: editData.amount,
            paid_date: editData.paid_date,
            payment_mode: editData.payment_mode ?? "UPI",
            notes: editData.notes ?? "",
          }
        : {
            employee_name: "",
            employee_number: "",
            amount: 0,
            paid_date: new Date().toISOString().split("T")[0],
            payment_mode: "UPI",
            notes: "",
          }
    );
  }, [open, editData, form]);

  function handleEmployeeSelect(empNumber: string) {
    const emp = employees.find((e) => e.employee_number === empNumber);
    if (emp) {
      form.setValue("employee_name", emp.name);
      form.setValue("employee_number", emp.employee_number);
      form.setValue("notes", emp.role ?? "");
    }
  }

  const onSubmit = async (values: SalaryPaymentValues) => {
    try {
      const url = isEdit
        ? `/api/finance/salary-payments/${editData.id}`
        : "/api/finance/salary-payments";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save salary payment");
      }

      // Auto-save employee to master data (upsert)
      if (!isEdit && values.employee_name && values.employee_number) {
        await fetch("/api/finance/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.employee_name,
            employee_number: values.employee_number,
            role: values.notes || null,
          }),
        });
      }

      toast.success(isEdit ? "Payment updated" : "Salary payment added");
      onOpenChange(false);
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Salary Payment" : "Add Salary Payment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Employee selector — pick from saved employees or enter new */}
          {employees.length > 0 && !isEdit && (
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <Select onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick saved employee or enter new below" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_number} value={emp.employee_number}>
                      {emp.name} ({emp.employee_number}){emp.role ? ` · ${emp.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_name">Employee Name</Label>
              <Input
                id="employee_name"
                placeholder="e.g. Shaik Murad"
                {...form.register("employee_name")}
              />
              {form.formState.errors.employee_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.employee_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_number">Employee Number</Label>
              <Input
                id="employee_number"
                placeholder="e.g. XW01"
                {...form.register("employee_number")}
              />
              {form.formState.errors.employee_number && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.employee_number.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (INR)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...form.register("amount", { valueAsNumber: true })}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_date">Payment Date</Label>
              <Input
                id="paid_date"
                type="date"
                {...form.register("paid_date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select
              value={form.watch("payment_mode") || "UPI"}
              onValueChange={(v) => form.setValue("payment_mode", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Role</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="e.g. Head of Product & Design"
              {...form.register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Update"
                  : "Add Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
