"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Upload,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Download,
  Loader2,
  FileSpreadsheet,
  Link2,
  Plus,
  EyeOff,
  MoreHorizontal,
  Search,
  Receipt,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BankTransaction, ReconciliationBatch } from "@/types/finance";

interface ReconciliationViewProps {
  batches: ReconciliationBatch[];
}

function parseCSVRows(text: string): { date: string; description: string; debit: number; credit: number; balance?: number; reference?: string }[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: ReturnType<typeof parseCSVRows> = [];

  // HDFC bank statements have header junk rows, then a line like:
  // "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance"
  // followed by a ******** separator, then data rows.
  // Find the actual header row by looking for known column names.

  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const lower = lines[i].toLowerCase();
    if (
      (lower.includes("date") && (lower.includes("narration") || lower.includes("description"))) ||
      (lower.includes("date") && lower.includes("withdrawal")) ||
      (lower.includes("date") && lower.includes("debit"))
    ) {
      headerIdx = i;
      break;
    }
  }

  // Fallback: if no header found, try first line
  if (headerIdx === -1) headerIdx = 0;

  const headers = lines[headerIdx].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  // Find column indices
  const findCol = (keywords: string[]) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  const idxDate = findCol(["date"]);
  const idxDesc = findCol(["narration", "description", "particulars"]);
  const idxRef = findCol(["chq", "ref", "reference"]);
  const idxDebit = findCol(["withdrawal", "debit", "dr"]);
  const idxCredit = findCol(["deposit", "credit", "cr"]);
  const idxBalance = findCol(["closing balance", "balance"]);

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip separator rows (********)
    if (line.startsWith("*") || line.startsWith("=")) continue;

    const cells = line.split(",").map((c) => c.trim().replace(/"/g, ""));

    // Get date — skip rows without a valid date
    const dateVal = idxDate >= 0 ? cells[idxDate] ?? "" : cells[0] ?? "";
    if (!dateVal || !dateVal.match(/\d/)) continue;

    // Parse date (DD/MM/YY, DD/MM/YYYY, or YYYY-MM-DD)
    let parsedDate = dateVal;
    if (dateVal.includes("/")) {
      const parts = dateVal.split("/");
      if (parts.length === 3) {
        const [d, m, y] = parts;
        parsedDate = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }

    const parseAmt = (idx: number) => {
      if (idx < 0 || !cells[idx]) return 0;
      return parseFloat(cells[idx].replace(/,/g, "")) || 0;
    };

    const debit = parseAmt(idxDebit);
    const credit = parseAmt(idxCredit);
    if (debit === 0 && credit === 0) continue;

    const descVal = idxDesc >= 0 ? cells[idxDesc] ?? "" : cells[1] ?? "";
    const refVal = idxRef >= 0 ? cells[idxRef] ?? "" : "";
    const balanceVal = parseAmt(idxBalance);

    // Validate date is a proper YYYY-MM-DD format
    if (!parsedDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    rows.push({
      date: parsedDate,
      description: descVal,
      debit,
      credit,
      balance: balanceVal || undefined,
      reference: refVal || undefined,
    });
  }

  return rows;
}

export function ReconciliationView({ batches: initialBatches }: ReconciliationViewProps) {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    batch_id: string;
    total: number;
    matched: number;
    unmatched: number;
  } | null>(null);
  const [batchData, setBatchData] = useState<{
    batch: ReconciliationBatch;
    earnings: BankTransaction[];
    spends: BankTransaction[];
    salaries: BankTransaction[];
    ignored: BankTransaction[];
    unmatched: BankTransaction[];
  } | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [linkTxn, setLinkTxn] = useState<BankTransaction | null>(null);
  const [revertBatchId, setRevertBatchId] = useState<string | null>(null);

  async function confirmRevertBatch() {
    if (!revertBatchId) return;
    try {
      const res = await fetch(`/api/finance/reconciliation/${revertBatchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Import reverted — all rows deleted");
      setBatchData(null);
      setResult(null);
      setRevertBatchId(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete batch");
    }
  }

  async function handleCreateExpense(txn: BankTransaction) {
    const amount = txn.debit > 0 ? txn.debit : txn.credit;
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          category: "Miscellaneous",
          date: txn.date,
          description: txn.description,
          gst_applicable: false,
          payment_mode: txn.description.toLowerCase().includes("upi") ? "UPI" : "Bank Transfer",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      // Link the bank txn to this new expense
      if (batchData) {
        await fetch(`/api/finance/reconciliation/${batchData.batch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: txn.id,
            reconciled: true,
            matched_type: "expense",
            matched_id: data.id,
          }),
        });
        await loadBatch(batchData.batch.id);
      }
      toast.success("Expense created and linked");
    } catch {
      toast.error("Failed to create expense");
    }
  }

  async function handleIgnore(txn: BankTransaction) {
    if (!batchData) return;
    await fetch(`/api/finance/reconciliation/${batchData.batch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_id: txn.id,
        reconciled: true,
        matched_type: "ignored",
      }),
    });
    await loadBatch(batchData.batch.id);
    toast.success("Marked as ignored");
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSVRows(text);

      if (rows.length === 0) {
        toast.error("No valid transactions found in CSV");
        return;
      }

      // Upload the CSV file to Supabase Storage for record-keeping
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/finance/upload-attachment", {
        method: "POST",
        body: uploadForm,
      });
      const fileUrl = uploadRes.ok ? (await uploadRes.json()).url : null;

      const res = await fetch("/api/finance/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, rows, file_url: fileUrl }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      toast.success(`Matched ${data.matched} of ${data.total} transactions`);

      // Load the batch detail
      await loadBatch(data.batch_id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process bank statement");
    } finally {
      setUploading(false);
    }
  }, [month, router]);

  async function loadBatch(batchId: string) {
    setLoadingBatch(true);
    try {
      const res = await fetch(`/api/finance/reconciliation/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch");
      const data = await res.json();
      setBatchData(data);
    } catch {
      toast.error("Failed to load reconciliation data");
    } finally {
      setLoadingBatch(false);
    }
  }

  async function toggleMatch(txnId: string, reconciled: boolean, batchId: string) {
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txnId, reconciled }),
    });
    await loadBatch(batchId);
  }

  function downloadMonthlyReport() {
    window.open(`/api/finance/reports/monthly-xlsx?month=${month}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold">Upload Bank Statement</h3>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <label>
            <div className="inline-flex">
              <Button variant="outline" disabled={uploading} asChild>
                <span>
                  {uploading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  Upload CSV
                </span>
              </Button>
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {batchData && (
            <Button variant="outline" onClick={downloadMonthlyReport}>
              <FileSpreadsheet className="mr-2 size-4" />
              Generate XLSX Report
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Supports HDFC, ICICI, SBI, Axis bank CSV formats. Auto-detects columns.
        </p>
      </div>

      {/* Results Summary */}
      {result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Transactions" value={result.total} format="number" index={0} />
          <StatCard label="Auto-Matched" value={result.matched} format="number" color="emerald" index={1} />
          <StatCard label="Unmatched" value={result.unmatched} format="number" color="amber" index={2} />
          <StatCard
            label="Match Rate"
            value={result.total > 0 ? Math.round((result.matched / result.total) * 100) : 0}
            format="percent"
            index={3}
          />
        </div>
      )}

      {/* Previous Batches */}
      {!batchData && initialBatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Previous Reconciliations</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Unmatched</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBatches.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadBatch(b.id)}>
                    <TableCell className="font-medium">
                      {new Date(b.year, parseInt(b.month) - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </TableCell>
                    <TableCell>{b.total_count}</TableCell>
                    <TableCell className="text-emerald-600">{b.matched_count}</TableCell>
                    <TableCell className="text-amber-600">{b.unmatched_count}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "completed" ? "default" : "secondary"} className="text-xs">
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {b.file_url && (
                          <a href={b.file_url} target="_blank" rel="noopener">
                            <Button variant="ghost" size="sm" className="text-xs h-7"><FileSpreadsheet className="mr-1 size-3" />File</Button>
                          </a>
                        )}
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => loadBatch(b.id)}>View</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-destructive hover:text-destructive"
                          onClick={() => setRevertBatchId(b.id)}
                        >
                          Revert
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Batch Detail — 3 Tabs */}
      {loadingBatch && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {batchData && !loadingBatch && (
        <>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {batchData.earnings.length + batchData.spends.length + batchData.salaries.length + batchData.ignored.length + batchData.unmatched.length} transactions · {batchData.unmatched.length} unmatched
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setRevertBatchId(batchData.batch.id)}
          >
            Revert Import
          </Button>
        </div>
        <Tabs defaultValue="earnings">
          <TabsList>
            <TabsTrigger value="earnings">
              Earnings ({batchData.earnings.length})
            </TabsTrigger>
            <TabsTrigger value="spends">
              Spends ({batchData.spends.length})
            </TabsTrigger>
            <TabsTrigger value="salaries">
              Salaries ({batchData.salaries.length})
            </TabsTrigger>
            <TabsTrigger value="ignored">
              Ignored ({batchData.ignored.length})
            </TabsTrigger>
            <TabsTrigger value="unmatched">
              Unmatched ({batchData.unmatched.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earnings" className="mt-4">
            <BankTxnTable
              transactions={batchData.earnings}
              type="credit"
              batchId={batchData.batch.id}
              onToggle={toggleMatch}
              onLinkInvoice={setLinkTxn}
              onCreateExpense={handleCreateExpense}
              onIgnore={handleIgnore}
            />
          </TabsContent>
          <TabsContent value="spends" className="mt-4">
            <BankTxnTable
              transactions={batchData.spends}
              type="debit"
              batchId={batchData.batch.id}
              onToggle={toggleMatch}
              onLinkInvoice={setLinkTxn}
              onCreateExpense={handleCreateExpense}
              onIgnore={handleIgnore}
            />
          </TabsContent>
          <TabsContent value="salaries" className="mt-4">
            <BankTxnTable
              transactions={batchData.salaries}
              type="debit"
              batchId={batchData.batch.id}
              onToggle={toggleMatch}
              onLinkInvoice={setLinkTxn}
              onCreateExpense={handleCreateExpense}
              onIgnore={handleIgnore}
            />
          </TabsContent>
          <TabsContent value="ignored" className="mt-4">
            <BankTxnTable
              transactions={batchData.ignored}
              type="both"
              batchId={batchData.batch.id}
              onToggle={toggleMatch}
              onLinkInvoice={setLinkTxn}
              onCreateExpense={handleCreateExpense}
              onIgnore={handleIgnore}
            />
          </TabsContent>
          <TabsContent value="unmatched" className="mt-4">
            <BankTxnTable
              transactions={batchData.unmatched}
              type="both"
              batchId={batchData.batch.id}
              onToggle={toggleMatch}
              onLinkInvoice={setLinkTxn}
              onCreateExpense={handleCreateExpense}
              onIgnore={handleIgnore}
            />
          </TabsContent>
        </Tabs>
        </>
      )}

      {/* Revert Confirmation */}
      <ConfirmDialog
        open={!!revertBatchId}
        onOpenChange={(open) => { if (!open) setRevertBatchId(null); }}
        title="Revert Import"
        description="This will permanently delete all transactions from this import, including any matches and reconciliation progress. This cannot be undone."
        onConfirm={confirmRevertBatch}
        destructive
      />

      {/* Link to Invoice Dialog */}
      {batchData && (
        <LinkInvoiceDialog
          open={!!linkTxn}
          onOpenChange={(open) => { if (!open) setLinkTxn(null); }}
          txn={linkTxn}
          batchId={batchData.batch.id}
          onLinked={() => loadBatch(batchData.batch.id)}
        />
      )}
    </div>
  );
}

function BankTxnTable({
  transactions,
  type,
  batchId,
  onToggle,
  onLinkInvoice,
  onCreateExpense,
  onIgnore,
}: {
  transactions: BankTransaction[];
  type: "credit" | "debit" | "both";
  batchId: string;
  onToggle: (txnId: string, reconciled: boolean, batchId: string) => void;
  onLinkInvoice: (txn: BankTransaction) => void;
  onCreateExpense: (txn: BankTransaction) => void;
  onIgnore: (txn: BankTransaction) => void;
}) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions in this category.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Match</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="text-sm tabular-nums text-muted-foreground">
                {format(new Date(txn.date + "T00:00:00"), "dd MMM")}
              </TableCell>
              <TableCell className="text-sm max-w-[300px] truncate">
                {txn.description}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {type === "credit" || (type === "both" && txn.credit > 0) ? (
                  <span className="text-emerald-600">+{formatCurrency(txn.credit)}</span>
                ) : (
                  <span className="text-red-600">-{formatCurrency(txn.debit)}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {txn.matched_type === "ignored" ? (
                  <Badge variant="secondary" className="text-xs text-muted-foreground">
                    <EyeOff className="mr-1 size-3" />
                    Ignored
                  </Badge>
                ) : txn.matched_type === "cashfree_settlement" ? (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                    <ArrowRightLeft className="mr-1 size-3" />
                    Cashfree
                  </Badge>
                ) : txn.matched_type === "credit_card_payment" ? (
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                    <CreditCard className="mr-1 size-3" />
                    Card Payment
                  </Badge>
                ) : txn.matched_type ? (
                  <Badge variant="outline" className="text-xs">
                    <ArrowRightLeft className="mr-1 size-3" />
                    {txn.matched_type}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onToggle(txn.id, !txn.reconciled, batchId)}
                  >
                    {txn.reconciled ? (
                      <CheckCircle2 className="mr-1 size-3 text-emerald-600" />
                    ) : (
                      <XCircle className="mr-1 size-3 text-muted-foreground" />
                    )}
                    {txn.reconciled ? "Matched" : "Unmatched"}
                  </Button>
                  {!txn.reconciled && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLinkInvoice(txn)}>
                          <Link2 className="mr-2 size-3.5" />
                          Link to Invoice
                        </DropdownMenuItem>
                        {txn.debit > 0 && (
                          <DropdownMenuItem onClick={() => onCreateExpense(txn)}>
                            <Plus className="mr-2 size-3.5" />
                            Create Expense
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onIgnore(txn)}>
                          <EyeOff className="mr-2 size-3.5" />
                          Ignore (not business)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Link to Invoice Dialog                                             */
/* ------------------------------------------------------------------ */
function LinkInvoiceDialog({
  open,
  onOpenChange,
  txn,
  batchId,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txn: BankTransaction | null;
  batchId: string;
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{
    invoices: { id: string; invoice_number: string; total: number; status: string; client_name: string; has_installments: boolean }[];
    installments: { id: string; invoice_id: string; installment_number: number; amount: number; status: string; invoice_number: string; client_name: string; due_date: string }[];
  }>({ invoices: [], installments: [] });
  const [loading, setLoading] = useState(false);

  async function searchInvoices(q: string) {
    setLoading(true);
    try {
      const amount = txn ? (txn.credit > 0 ? txn.credit : txn.debit) : 0;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (amount > 0) params.set("amount", String(amount));

      const res = await fetch(`/api/finance/reconciliation/search-invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Search on open with amount pre-filled
  useState(() => {
    if (open && txn) searchInvoices("");
  });

  async function linkToInvoice(invoiceId: string) {
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_id: txn?.id,
        reconciled: true,
        matched_type: "invoice",
        matched_id: invoiceId,
      }),
    });
    toast.success("Linked to invoice");
    onOpenChange(false);
    onLinked();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link to Invoice</DialogTitle>
        </DialogHeader>

        {txn && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{txn.description}</p>
            <p className="text-muted-foreground mt-1">
              {format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} ·{" "}
              <span className="font-mono font-medium">
                {formatCurrency(txn.credit > 0 ? txn.credit : txn.debit)}
              </span>
            </p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by client name or invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchInvoices(search)}
            className="pl-8"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => searchInvoices(search)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Search className="mr-2 size-3" />}
          Search
        </Button>

        {/* Invoices */}
        {results.invoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Invoices</p>
            {results.invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => linkToInvoice(inv.id)}
                className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium">{inv.invoice_number}</span>
                  <span className="text-sm text-muted-foreground ml-2">{inv.client_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{formatCurrency(inv.total)}</span>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                    {inv.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Installments */}
        {results.installments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Installments</p>
            {results.installments.map((inst) => (
              <button
                key={inst.id}
                onClick={() => linkToInvoice(inst.invoice_id)}
                className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div>
                  <span className="text-sm font-medium">{inst.invoice_number}</span>
                  <span className="text-xs text-muted-foreground ml-1">#{inst.installment_number}</span>
                  <span className="text-sm text-muted-foreground ml-2">{inst.client_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{formatCurrency(inst.amount)}</span>
                  <Badge variant={inst.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                    {inst.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && results.invoices.length === 0 && results.installments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No matching invoices found. Try searching by client name.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
