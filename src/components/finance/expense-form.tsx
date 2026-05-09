"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Upload, X, FileText, Loader2 } from "lucide-react";
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

const GST_RATES = [
  { label: "5%", value: 5 },
  { label: "12%", value: 12 },
  { label: "18%", value: 18 },
  { label: "28%", value: 28 },
];

const PAYMENT_MODES = ["UPI", "Credit Card", "Bank Transfer", "Cash", "Cheque"];

const TDS_SECTIONS = [
  { label: "194C - Contractors", value: "194C" },
  { label: "194J - Professional/Technical", value: "194J" },
  { label: "194H - Commission/Brokerage", value: "194H" },
  { label: "194I - Rent", value: "194I" },
  { label: "194A - Interest", value: "194A" },
  { label: "194B - Lottery/Winnings", value: "194B" },
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
    gst_rate?: number | null;
    vendor_gstin?: string | null;
    payment_mode?: string | null;
    receipt_url: string | null;
    attachment_url?: string | null;
    contact_id: string | null;
    tds_section?: string | null;
    tds_rate?: number | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      category: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      gst_applicable: false,
      gst_rate: null,
      vendor_gstin: "",
      payment_mode: "UPI",
      receipt_url: "",
      attachment_url: "",
      contact_id: "",
      tds_section: "",
      tds_rate: null,
    },
  });

  // Re-sync form when dialog opens or edit target changes
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
            gst_rate: editData.gst_rate ?? null,
            vendor_gstin: editData.vendor_gstin ?? "",
            payment_mode: editData.payment_mode ?? "UPI",
            receipt_url: editData.receipt_url ?? "",
            attachment_url: editData.attachment_url ?? "",
            contact_id: editData.contact_id ?? "",
            tds_section: editData.tds_section ?? "",
            tds_rate: editData.tds_rate ?? null,
          }
        : {
            amount: 0,
            category: "",
            date: new Date().toISOString().split("T")[0],
            description: "",
            gst_applicable: false,
            gst_rate: null,
            vendor_gstin: "",
            payment_mode: "UPI",
            receipt_url: "",
            attachment_url: "",
            contact_id: "",
            tds_section: "",
            tds_rate: null,
          }
    );
  }, [open, editData, form]);

  const gstApplicable = form.watch("gst_applicable");
  const gstRate = form.watch("gst_rate");
  const amount = form.watch("amount");
  const tdsSection = form.watch("tds_section");
  const tdsRate = form.watch("tds_rate");
  const receiptUrl = form.watch("receipt_url");

  // Computed GST breakup
  const gstAmount = gstApplicable && gstRate ? Math.round(amount * (gstRate / 100)) : 0;
  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;

  // Computed TDS
  const tdsAmount = tdsRate ? Math.round(amount * (tdsRate / 100)) : 0;

  async function handleFileUpload(file: File) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/finance/upload-attachment", {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Upload failed");
      form.setValue("receipt_url", body.url, { shouldDirty: true });
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/finance/upload-attachment", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      form.setValue("attachment_url", url);
      toast.success("File attached");
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...form.register("description")} />
          </div>

          {/* GST Section */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">GST (Input Tax)</Label>
              <Switch
                checked={gstApplicable}
                onCheckedChange={(v) => {
                  form.setValue("gst_applicable", v);
                  if (!v) { form.setValue("gst_rate", null); form.setValue("vendor_gstin", ""); }
                }}
              />
            </div>
            {gstApplicable && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">GST Rate</Label>
                    <Select value={gstRate ? String(gstRate) : ""} onValueChange={(v) => form.setValue("gst_rate", Number(v))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select rate" /></SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (<SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vendor GSTIN</Label>
                    <Input className="h-8" placeholder="e.g. 29AAHCE9805F1ZE" {...form.register("vendor_gstin")} />
                  </div>
                </div>
                {gstRate && amount > 0 && (
                  <div className="flex items-center gap-3 rounded bg-muted/50 px-3 py-2 text-xs">
                    <span>CGST: <strong>{cgst.toLocaleString("en-IN")}</strong></span>
                    <span className="text-muted-foreground">+</span>
                    <span>SGST: <strong>{sgst.toLocaleString("en-IN")}</strong></span>
                    <span className="text-muted-foreground">=</span>
                    <span>Total GST: <strong>{gstAmount.toLocaleString("en-IN")}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TDS Section */}
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">TDS (Tax Deducted at Source)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">TDS Section</Label>
                <Select
                  value={tdsSection || ""}
                  onValueChange={(v) => {
                    form.setValue("tds_section", v);
                    const defaults: Record<string, number> = { "194C": 2, "194J": 10, "194H": 5, "194I": 10, "194A": 10, "194B": 30 };
                    if (defaults[v]) form.setValue("tds_rate", defaults[v]);
                  }}
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {TDS_SECTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {tdsSection && (
                <div className="space-y-1.5">
                  <Label className="text-xs">TDS Rate (%)</Label>
                  <Input className="h-8" type="number" step="0.1" {...form.register("tds_rate", { valueAsNumber: true })} />
                </div>
              )}
            </div>
            {tdsSection && tdsRate && amount > 0 && (
              <div className="rounded bg-muted/50 px-3 py-2 text-xs">
                TDS @ {tdsRate}%: <strong>{tdsAmount.toLocaleString("en-IN")}</strong>
              </div>
            )}
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>Attach Invoice / Document</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Upload className="size-4 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">
                    {form.watch("attachment_url") ? "File attached" : "Upload PDF or image (max 5MB)"}
                  </span>
                </div>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleAttachmentUpload} disabled={uploading} />
              </label>
              {form.watch("attachment_url") && (
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => form.setValue("attachment_url", "")}>Remove</Button>
              )}
            </div>
          </div>

          {/* Receipt */}
          <div className="space-y-2">
            <Label>Receipt / Bill (optional)</Label>
            {receiptUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-primary hover:underline">
                  {receiptUrl.split("/").pop() ?? receiptUrl}
                </a>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => form.setValue("receipt_url", "", { shouldDirty: true })}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full justify-center" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 size-4" />
                {uploading ? "Uploading..." : "Upload PDF or image"}
              </Button>
            )}
            <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            <Input type="hidden" {...form.register("receipt_url")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : isEdit ? "Update" : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
