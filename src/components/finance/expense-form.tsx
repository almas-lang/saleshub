"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Upload, X, FileText } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseValues } from "@/lib/validations";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExpenseCategory } from "@/types/finance";

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: "1", name: "Advertising", icon: "Megaphone", color: "#EF4444", is_system: true, created_at: "" },
  { id: "2", name: "Software & Tools", icon: "Monitor", color: "#3B82F6", is_system: true, created_at: "" },
  { id: "3", name: "Freelancers & Contractors", icon: "UserCheck", color: "#8B5CF6", is_system: true, created_at: "" },
  { id: "4", name: "Content Production", icon: "Film", color: "#F59E0B", is_system: true, created_at: "" },
  { id: "5", name: "Office & Supplies", icon: "Building2", color: "#6B7280", is_system: true, created_at: "" },
  { id: "6", name: "Travel & Events", icon: "Plane", color: "#14B8A6", is_system: true, created_at: "" },
  { id: "7", name: "Communication (Phone/Internet)", icon: "Wifi", color: "#06B6D4", is_system: true, created_at: "" },
  { id: "8", name: "Training & Education", icon: "GraduationCap", color: "#EC4899", is_system: true, created_at: "" },
  { id: "9", name: "Taxes & Compliance", icon: "FileText", color: "#84CC16", is_system: true, created_at: "" },
  { id: "10", name: "Salary & Payroll", icon: "Users", color: "#F97316", is_system: true, created_at: "" },
  { id: "11", name: "Miscellaneous", icon: "MoreHorizontal", color: "#9CA3AF", is_system: true, created_at: "" },
];

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: ExpenseCategory[];
  editData?: {
    id: string;
    amount: number;
    category: string;
    date: string;
    description: string | null;
    gst_applicable: boolean | null;
    receipt_url: string | null;
    contact_id: string | null;
  };
}

export function ExpenseForm({
  open,
  onOpenChange,
  categories = DEFAULT_CATEGORIES,
  editData,
}: ExpenseFormProps) {
  const router = useRouter();
  const isEdit = !!editData;

  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: editData
      ? {
          amount: editData.amount,
          category: editData.category,
          date: editData.date,
          description: editData.description ?? "",
          gst_applicable: editData.gst_applicable ?? false,
          receipt_url: editData.receipt_url ?? "",
          contact_id: editData.contact_id ?? "",
        }
      : {
          amount: 0,
          category: "",
          date: new Date().toISOString().split("T")[0],
          description: "",
          gst_applicable: false,
          receipt_url: "",
          contact_id: "",
        },
  });

  // The dialog persists across opens, so re-sync the form whenever the
  // edit target changes (or the dialog is reopened in add mode).
  useEffect(() => {
    if (!open) return;
    form.reset(
      editData
        ? {
            amount: editData.amount,
            category: editData.category,
            date: editData.date,
            description: editData.description ?? "",
            gst_applicable: editData.gst_applicable ?? false,
            receipt_url: editData.receipt_url ?? "",
            contact_id: editData.contact_id ?? "",
          }
        : {
            amount: 0,
            category: "",
            date: new Date().toISOString().split("T")[0],
            description: "",
            gst_applicable: false,
            receipt_url: "",
            contact_id: "",
          }
    );
  }, [open, editData, form]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const receiptUrl = form.watch("receipt_url");

  async function handleReceiptUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/expenses/receipt/upload", {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Upload failed");
      }
      form.setValue("receipt_url", body.url, { shouldDirty: true });
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const onSubmit = async (values: ExpenseValues) => {
    try {
      const url = isEdit
        ? `/api/transactions/${editData.id}`
        : "/api/transactions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save expense");
      }

      toast.success(isEdit ? "Expense updated" : "Expense added");
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
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...form.register("date")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v) => form.setValue("category", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p className="text-xs text-destructive">
                {form.formState.errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              {...form.register("description")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch("gst_applicable")}
              onCheckedChange={(v) => form.setValue("gst_applicable", v)}
            />
            <Label>GST applicable (18%)</Label>
          </div>

          <div className="space-y-2">
            <Label>Receipt / Bill (optional)</Label>
            {receiptUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-sm text-primary hover:underline"
                >
                  {receiptUrl.split("/").pop() ?? receiptUrl}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() =>
                    form.setValue("receipt_url", "", { shouldDirty: true })
                  }
                  aria-label="Remove receipt"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 size-4" />
                {uploading ? "Uploading..." : "Upload PDF or image"}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleReceiptUpload(f);
              }}
            />
            <Input type="hidden" {...form.register("receipt_url")} />
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
                  : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
