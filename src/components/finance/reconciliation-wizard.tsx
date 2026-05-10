"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Upload,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Loader2,
  FileSpreadsheet,
  Link2,
  Plus,
  EyeOff,
  MoreHorizontal,
  Search,
  CreditCard,
  Landmark,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  Users,
  Pencil,
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { BankTransaction, ReconciliationBatch } from "@/types/finance";

/* ── File Detection + Parsers ─────────────────────────── */

type FileType = "bank" | "cashfree" | "settlement" | "card" | "unknown";

function detectFileType(text: string): FileType {
  const header = text.split("\n")[0]?.toLowerCase() ?? "";
  const fullLower = text.toLowerCase();

  // HDFC Credit Card: uses ~|~ delimiter and has "transaction type" somewhere in the file
  if (text.includes("~|~") && (fullLower.includes("transaction type") || fullLower.includes("billed") || fullLower.includes("credit limit"))) return "card";

  // Cashfree Transaction Report: has "Order Id" and "Service Charge" in header
  if (header.includes("order id") && header.includes("service charge")) return "cashfree";

  // Cashfree Settlement Report
  if (header.includes("total transaction amount") && header.includes("net settlement amount")) return "settlement";

  // HDFC Bank Statement: has "Narration" and "Withdrawal" in first 30 lines
  const first30 = text.split("\n").slice(0, 30).join("\n").toLowerCase();
  if (first30.includes("narration") && first30.includes("withdrawal")) return "bank";
  if (first30.includes("date") && first30.includes("debit") && first30.includes("credit")) return "bank";

  return "unknown";
}

function parseQuotedCSV(line: string): string[] {
  const cells: string[] = []; let current = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { cells.push(current.trim()); current = ""; }
    else current += ch;
  }
  cells.push(current.trim()); return cells;
}

function parseBankCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: { date: string; description: string; debit: number; credit: number; balance?: number; reference?: string }[] = [];
  let hIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const lo = lines[i].toLowerCase();
    if ((lo.includes("date") && (lo.includes("narration") || lo.includes("description"))) || (lo.includes("date") && lo.includes("withdrawal"))) { hIdx = i; break; }
  }
  if (hIdx === -1) return rows;
  const headers = lines[hIdx].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const fc = (kw: string[]) => headers.findIndex((h) => kw.some((k) => h.includes(k)));
  const iD = fc(["date"]), iN = fc(["narration", "description"]), iR = fc(["chq", "ref"]),
    iW = fc(["withdrawal", "debit"]), iC = fc(["deposit", "credit"]), iB = fc(["closing balance", "balance"]);
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("*")) continue;
    const c = lines[i].split(",").map((s) => s.trim().replace(/"/g, ""));
    const dv = iD >= 0 ? c[iD] ?? "" : c[0] ?? "";
    if (!dv.match(/\d/)) continue;
    let pd = dv;
    if (dv.includes("/")) { const [d, m, y] = dv.split("/"); if (d && m && y) pd = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
    if (!pd.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
    const pa = (idx: number) => idx >= 0 && c[idx] ? parseFloat(c[idx].replace(/,/g, "")) || 0 : 0;
    const db = pa(iW), cr = pa(iC);
    if (db === 0 && cr === 0) continue;
    rows.push({ date: pd, description: iN >= 0 ? c[iN] ?? "" : c[1] ?? "", debit: db, credit: cr, balance: pa(iB) || undefined, reference: (iR >= 0 ? c[iR] : undefined) || undefined });
  }
  return rows;
}

function parseCashfreeCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseQuotedCSV(lines[0]).map((h) => h.toLowerCase());
  const fc = (kw: string[]) => headers.findIndex((h) => kw.some((k) => h.includes(k)));
  const iO = fc(["order id"]), iA = fc(["amount"]), iSC = fc(["service charge"]), iST = fc(["st/gst", "service tax"]),
    iSA = fc(["settlement amount"]), iU = fc(["utr no", "utr"]), iSO = fc(["settled on"]),
    iSt = fc(["transaction status"]), iSe = headers.findIndex((h) => h === "settlement"),
    iCN = fc(["customer name"]), iCP = fc(["customer phone"]), iCE = fc(["customer email"]), iPM = fc(["payment mode"]);
  const rows: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string; customer_name?: string; customer_phone?: string; customer_email?: string; payment_mode?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseQuotedCSV(lines[i]);
    if ((iSt >= 0 ? c[iSt] ?? "" : "").toUpperCase() !== "SUCCESS") continue;
    if ((iSe >= 0 ? c[iSe] ?? "" : "").toUpperCase() !== "SETTLED") continue;
    const pn = (idx: number) => idx >= 0 && c[idx] ? parseFloat(c[idx].replace(/,/g, "")) || 0 : 0;
    const so = iSO >= 0 ? (c[iSO] ?? "").split(" ")[0] : "";
    const utr = iU >= 0 ? c[iU] ?? "" : "";
    rows.push({
      settlement_id: utr || `S${i}`, settlement_date: so, order_id: iO >= 0 ? c[iO] ?? "" : "",
      order_amount: pn(iA), settlement_amount: pn(iSA) || pn(iA), service_charge: pn(iSC), service_tax: pn(iST), adjustment: 0, utr,
      customer_name: iCN >= 0 ? c[iCN] : undefined,
      customer_phone: iCP >= 0 ? c[iCP]?.replace(/^\+91/, "") : undefined,
      customer_email: iCE >= 0 ? c[iCE] : undefined,
      payment_mode: iPM >= 0 ? c[iPM] : undefined,
    });
  }
  return rows;
}

function parseSettlementCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseQuotedCSV(lines[0]).map((h) => h.toLowerCase());
  const fc = (kw: string[]) => headers.findIndex((h) => kw.some((k) => h.includes(k)));
  const iId = fc(["id"]), iTA = fc(["total transaction amount"]), iSA = fc(["settlement amount"]),
    iNA = fc(["net settlement amount"]), iU = fc(["utr no", "utr"]), iSD = fc(["settlement date"]),
    iSCh = fc(["settlement charge"]), iSTx = fc(["settlement tax"]), iAdj = fc(["adjustment"]);
  const rows: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string; net_settlement_amount?: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseQuotedCSV(lines[i]);
    const pn = (idx: number) => idx >= 0 && c[idx] ? parseFloat(c[idx].replace(/,/g, "")) || 0 : 0;
    const ta = pn(iTA), na = pn(iNA);
    if (ta === 0 && na === 0) continue;
    rows.push({ settlement_id: iId >= 0 ? c[iId] ?? `S${i}` : `S${i}`, settlement_date: iSD >= 0 ? (c[iSD] ?? "").split(" ")[0] : "", order_id: "", order_amount: ta, settlement_amount: pn(iSA), service_charge: pn(iSCh), service_tax: pn(iSTx), adjustment: pn(iAdj), utr: iU >= 0 ? c[iU] ?? "" : "", net_settlement_amount: na || undefined });
  }
  return rows;
}

function parseCardCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  const rows: { date: string; description: string; amount: number; type: "debit" | "credit"; reference?: string }[] = [];
  if (!text.includes("~|~")) return rows;
  let hIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("transaction type") && lines[i].includes("~|~") && lines[i].toLowerCase().includes("amt")) { hIdx = i; break; }
  }
  if (hIdx === -1) return rows;
  const headers = lines[hIdx].split("~|~").map((h) => h.trim().toLowerCase());
  const fc = (kw: string[]) => headers.findIndex((h) => kw.some((k) => h.includes(k)));
  const iD = fc(["date"]), iDe = fc(["description"]), iA = fc(["amt", "amount"]), iDC = fc(["debit", "credit"]);
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (!lines[i].includes("~|~")) continue;
    const c = lines[i].split("~|~").map((s) => s.trim());
    const f = c[0]?.toLowerCase() ?? "";
    if (!f.includes("domestic") && !f.includes("international")) continue;
    const dv = iD >= 0 ? c[iD] ?? "" : "";
    if (!dv.match(/\d{2}\/\d{2}\/\d{4}/)) continue;
    const dp = dv.split(" ")[0]; const [d, m, y] = dp.split("/");
    const pd = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const amt = parseFloat((iA >= 0 ? c[iA] ?? "" : "").replace(/,/g, "")) || 0;
    if (amt === 0) continue;
    const dc = iDC >= 0 ? (c[iDC] ?? "").toLowerCase().trim() : "";
    const desc = iDe >= 0 ? c[iDe] ?? "" : "";
    if (desc.startsWith("IGST-") || desc.includes("CONSOLIDATED FCY")) continue;
    rows.push({ date: pd, description: desc, amount: amt, type: dc.includes("cr") ? "credit" : "debit" });
  }
  return rows;
}

/* ── Types ─────────────────────────────────────────────── */

interface UploadedFile { name: string; type: FileType; file: File; rowCount: number; }
interface WizardResult { batch_id: string; total: number; matched: number; unmatched: number; }

/* ── Step 1: Upload ───────────────────────────────────── */

function StepUpload({ files, onAddFiles, onRemoveFile, month, onMonthChange, onNext }: {
  files: UploadedFile[]; onAddFiles: (f: UploadedFile[]) => void; onRemoveFile: (i: number) => void;
  month: string; onMonthChange: (m: string) => void; onNext: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const processFiles = useCallback(async (fl: FileList) => {
    const nf: UploadedFile[] = [];
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]; const text = await f.text(); const type = detectFileType(text);
      let rc = 0;
      if (type === "bank") rc = parseBankCSV(text).length;
      else if (type === "cashfree") rc = parseCashfreeCSV(text).length;
      else if (type === "settlement") rc = parseSettlementCSV(text).length;
      else if (type === "card") rc = parseCardCSV(text).length;
      nf.push({ name: f.name, type, file: f, rowCount: rc });
    }
    onAddFiles(nf);
  }, [onAddFiles]);

  const labels: Record<FileType, { label: string; icon: typeof FileText; color: string }> = {
    bank: { label: "Bank Statement", icon: Landmark, color: "text-blue-600" },
    cashfree: { label: "Cashfree Transactions", icon: ArrowRightLeft, color: "text-emerald-600" },
    settlement: { label: "Cashfree Settlement", icon: FileSpreadsheet, color: "text-teal-600" },
    card: { label: "Credit Card Statement", icon: CreditCard, color: "text-purple-600" },
    unknown: { label: "Unknown Format", icon: FileText, color: "text-amber-600" },
  };
  const hasValid = files.some((f) => f.type !== "unknown" && f.rowCount > 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Month to Reconcile</Label>
        <Input type="month" value={month} onChange={(e) => onMonthChange(e.target.value)} className="w-56" />
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"}`}
      >
        <Upload className="size-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drop your files here</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">Bank statement, Cashfree reports, Credit card statement — all at once</p>
        <label>
          <Button variant="outline" size="sm" asChild><span><Upload className="mr-2 size-4" />Browse Files</span></Button>
          <input type="file" accept=".csv" multiple className="hidden" onChange={(e) => e.target.files && processFiles(e.target.files)} />
        </label>
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{files.length} file{files.length !== 1 ? "s" : ""} uploaded</p>
          {files.map((f, i) => { const m = labels[f.type]; const Icon = m.icon; return (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Icon className={`size-5 ${m.color}`} />
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{m.label}</Badge>
                    <span className="text-xs text-muted-foreground">{f.rowCount} rows</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {f.type === "unknown" && <span className="text-xs text-amber-600">Could not detect format</span>}
                {f.rowCount === 0 && f.type !== "unknown" && <span className="text-xs text-amber-600">No valid rows</span>}
                <Button variant="ghost" size="icon" className="size-7" onClick={() => onRemoveFile(i)}><X className="size-4" /></Button>
              </div>
            </div>
          ); })}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!hasValid}>Reconcile<ChevronRight className="ml-2 size-4" /></Button>
      </div>
    </div>
  );
}

/* ── Step 2: Review ───────────────────────────────────── */

function StepReview({ batchId, onBack, onNext }: { batchId: string; onBack: () => void; onNext: () => void }) {
  const [data, setData] = useState<{ batch: ReconciliationBatch; earnings: BankTransaction[]; spends: BankTransaction[]; salaries: BankTransaction[]; ignored: BankTransaction[]; unmatched: BankTransaction[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(""); // persist tab across reloads
  const [linkTxn, setLinkTxn] = useState<BankTransaction | null>(null);
  const [expenseTxn, setExpenseTxn] = useState<BankTransaction | null>(null);
  const [linkExpenseTxn, setLinkExpenseTxn] = useState<BankTransaction | null>(null);
  const [salaryTxn, setSalaryTxn] = useState<BankTransaction | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [editTxn, setEditTxn] = useState<BankTransaction | null>(null);

  async function handleEditSave(txnId: string, newDescription: string) {
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txnId, description: newDescription }),
    });
    setEditTxn(null);
    await load();
    toast.success("Updated");
  }

  async function load() { setLoading(true); const r = await fetch(`/api/finance/reconciliation/${batchId}`); if (r.ok) setData(await r.json()); setLoading(false); }
  useState(() => { load(); });

  async function toggleMatch(id: string, reconciled: boolean) {
    await fetch(`/api/finance/reconciliation/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: id, reconciled }) });
    await load();
  }

  async function handleSalarySaved(salaryId: string, txn: BankTransaction) {
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "salary", matched_id: salaryId }),
    });
    setSalaryTxn(null);
    await load();
    toast.success("Salary recorded and linked");
  }

  async function handleLinkExpense(txn: BankTransaction, expenseId: string) {
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "expense", matched_id: expenseId }),
    });
    setLinkExpenseTxn(null);
    await load();
    toast.success("Linked to expense");
  }

  async function handleExpenseSaved(expenseId: string, txn: BankTransaction) {
    // Link the bank transaction to the newly created expense
    await fetch(`/api/finance/reconciliation/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "expense", matched_id: expenseId }),
    });
    setExpenseTxn(null);
    await load();
    toast.success("Bill recorded and linked");
  }

  async function ignore(txn: BankTransaction) {
    await fetch(`/api/finance/reconciliation/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "ignored" }) });
    await load(); toast.success("Ignored");
  }
  async function linkInvoice(txn: BankTransaction, invoiceId: string) {
    await fetch(`/api/finance/reconciliation/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "invoice", matched_id: invoiceId }) });
    setLinkTxn(null); await load(); toast.success("Linked");
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">Failed to load.</p>;

  const total = data.earnings.length + data.spends.length + data.salaries.length + data.ignored.length + data.unmatched.length;

  // Guess vendor name from description
  function guessVendor(desc: string): string {
    const d = desc.replace(/^CC:\s*|^UPI-/i, "").trim();
    // Extract vendor name from common patterns
    const patterns = [
      /^(.+?)\s+(?:SAN FRANCISC|MUMBAI|BANGALORE|HYDERABAD|GURGAON|GURUGRAM|DELHI)/i,
      /^(.+?)\s+USD/i,
      /^(.+?)-/,
    ];
    for (const p of patterns) {
      const m = d.match(p);
      if (m && m[1].length > 2) return m[1].trim();
    }
    return d.split(/\s+/).slice(0, 3).join(" ");
  }

  function guessCategory(desc: string): string {
    const d = desc.toLowerCase();
    if (d.includes("facebook") || d.includes("meta") || d.includes("google ads")) return "Advertising";
    if (d.includes("claude") || d.includes("anthropic") || d.includes("openai")) return "Software & Tools";
    if (d.includes("figma") || d.includes("canva") || d.includes("notion") || d.includes("slack")) return "Software & Tools";
    if (d.includes("google") || d.includes("workspace") || d.includes("aws") || d.includes("railway")) return "Software & Tools";
    if (d.includes("myntra") || d.includes("amazon") || d.includes("flipkart")) return "Office & Supplies";
    if (d.includes("swiggy") || d.includes("zomato") || d.includes("uber") || d.includes("ola")) return "Travel & Events";
    if (d.includes("airtel") || d.includes("jio") || d.includes("vodafone")) return "Communication (Phone/Internet)";
    if (d.includes("bescom") || d.includes("bwssb") || d.includes("electricity")) return "Office & Supplies";
    if (d.includes("udemy") || d.includes("coursera") || d.includes("uability")) return "Training & Education";
    return "Miscellaneous";
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary — Bank actuals + categorized breakdown */}
      {(() => {
        // All visible transactions across all tabs
        const allTxns = [...data.earnings, ...data.spends, ...data.salaries, ...data.ignored, ...data.unmatched];

        // Bank actuals — only from bank statement rows (not Cashfree/CC source rows)
        const bankRows = allTxns.filter((t) => !t.bank_name || t.bank_name === "HDFC" || (!t.bank_name?.includes("Cashfree") && !t.bank_name?.includes("Credit Card")));
        const bankCredits = bankRows.reduce((s, t) => s + t.credit, 0);
        const bankDebits = bankRows.reduce((s, t) => s + t.debit, 0);

        // Also add Cashfree earnings (order amounts, not settlement amounts)
        const cashfreeEarnings = data.earnings.filter((t) => t.bank_name === "Cashfree").reduce((s, t) => s + t.credit, 0);
        const totalMoneyIn = bankCredits + cashfreeEarnings;

        // Categorized totals
        const invoiceTotal = data.earnings.reduce((s, t) => s + t.credit, 0);
        const billsTotal = data.spends.filter((t) => t.matched_type !== "credit_card_payment").reduce((s, t) => s + t.debit, 0);
        const salaryTotal = data.salaries.reduce((s, t) => s + t.debit, 0);
        const netProfit = invoiceTotal - billsTotal - salaryTotal;

        const invoiceCount = data.earnings.filter((t) => t.matched_type === "invoice").length;
        const billsCount = data.spends.filter((t) => t.matched_type === "expense").length;

        return (
          <div className="space-y-3">
            {/* Row 1: Categorized P&L */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Invoice Revenue" value={invoiceTotal} color="emerald" index={0} />
              <StatCard label="Bills & Expenses" value={billsTotal} color="red" index={1} />
              <StatCard label="Salaries Paid" value={salaryTotal} color="blue" index={2} />
              <StatCard label="Net Profit" value={netProfit} color={netProfit >= 0 ? "emerald" : "red"} index={3} />
            </div>
            {/* Row 2: Counts + status */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Invoices</p>
                <p className="text-lg font-semibold">{invoiceCount}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bills</p>
                <p className="text-lg font-semibold">{billsCount}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Salaries</p>
                <p className="text-lg font-semibold">{data.salaries.length}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ignored</p>
                <p className="text-lg font-semibold">{data.ignored.length}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Matched</p>
                <p className="text-lg font-semibold text-emerald-600">{total - data.unmatched.length}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
                <p className="text-lg font-semibold text-amber-600">{data.unmatched.length}</p>
              </div>
            </div>
          </div>
        );
      })()}
      <Tabs value={activeTab || (data.unmatched.length > 0 ? "unmatched" : "earnings")} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="earnings">Earnings ({data.earnings.length})</TabsTrigger>
          <TabsTrigger value="spends">Spends ({data.spends.length})</TabsTrigger>
          <TabsTrigger value="salaries">Salaries ({data.salaries.length})</TabsTrigger>
          <TabsTrigger value="ignored">Ignored ({data.ignored.length})</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched ({data.unmatched.length}){data.unmatched.length > 0 && <span className="ml-1.5 size-2 rounded-full bg-amber-500 inline-block" />}</TabsTrigger>
        </TabsList>
        {(["earnings", "spends", "salaries", "ignored", "unmatched"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <TxnTable transactions={data[tab]} type={tab === "earnings" ? "credit" : tab === "unmatched" ? "both" : "debit"}
              onToggle={(id, r) => toggleMatch(id, r)} onLink={setLinkTxn} onLinkExpense={setLinkExpenseTxn} onExpense={setExpenseTxn} onSalary={setSalaryTxn} onIgnore={ignore} onViewInvoice={setViewInvoiceId} onEdit={setEditTxn} />
          </TabsContent>
        ))}
      </Tabs>
      {linkTxn && <LinkDialog txn={linkTxn} onClose={() => setLinkTxn(null)} onLink={(invId) => linkInvoice(linkTxn, invId)} />}

      {/* Record Bill/Expense Dialog */}
      {expenseTxn && (
        <RecordBillDialog
          txn={expenseTxn}
          vendorGuess={guessVendor(expenseTxn.description)}
          categoryGuess={guessCategory(expenseTxn.description)}
          onClose={() => setExpenseTxn(null)}
          onSaved={(expenseId) => handleExpenseSaved(expenseId, expenseTxn)}
        />
      )}

      {/* Link to Expense Dialog */}
      {linkExpenseTxn && (
        <LinkExpenseDialog
          txn={linkExpenseTxn}
          onClose={() => setLinkExpenseTxn(null)}
          onLink={(expenseId) => handleLinkExpense(linkExpenseTxn, expenseId)}
        />
      )}

      {/* Record Salary Dialog */}
      {salaryTxn && (
        <RecordSalaryDialog
          txn={salaryTxn}
          onClose={() => setSalaryTxn(null)}
          onSaved={(salaryId) => handleSalarySaved(salaryId, salaryTxn)}
        />
      )}

      {/* Invoice PDF Preview */}
      {viewInvoiceId && (
        <Dialog open onOpenChange={(o) => { if (!o) setViewInvoiceId(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice Preview</span>
                <a href={`/invoices/${viewInvoiceId}`} className="text-xs text-primary hover:underline font-normal">
                  Open full view ↗
                </a>
              </DialogTitle>
            </DialogHeader>
            <iframe
              src={`/api/invoices/${viewInvoiceId}/pdf`}
              className="w-full h-[78vh]"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Details Dialog */}
      {editTxn && (
        <EditTxnDialog
          txn={editTxn}
          onClose={() => setEditTxn(null)}
          onSave={(newDesc) => handleEditSave(editTxn.id, newDesc)}
        />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="mr-2 size-4" />Back</Button>
        <Button onClick={onNext}>Generate Report<ChevronRight className="ml-2 size-4" /></Button>
      </div>
    </div>
  );
}

function EditTxnDialog({ txn, onClose, onSave }: {
  txn: BankTransaction; onClose: () => void; onSave: (desc: string) => void;
}) {
  const [desc, setDesc] = useState(txn.description);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Description</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">
            {format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} ·{" "}
            <span className="font-mono font-medium">{formatCurrency(txn.credit > 0 ? txn.credit : txn.debit)}</span>
            <span className="ml-2 text-xs">via {txn.bank_name ?? "Bank"}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Description</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !desc} onClick={async () => {
            setSaving(true); await onSave(desc); setSaving(false);
          }}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Step 3: Export ────────────────────────────────────── */

function StepExport({ month, onBack }: { month: string; onBack: () => void }) {
  const [dl, setDl] = useState(false);
  const label = month ? new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";
  async function download() {
    setDl(true);
    try {
      const r = await fetch(`/api/finance/reports/monthly-xlsx?month=${month}`);
      if (!r.ok) throw new Error(); const b = await r.blob(); const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = `${label} Expwave - Sales and expenses.xlsx`; a.click(); URL.revokeObjectURL(u);
      toast.success("Report downloaded");
    } catch { toast.error("Failed"); } finally { setDl(false); }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-xl border p-12 text-center">
        <CheckCircle2 className="size-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-semibold">Reconciliation Complete</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">All transactions for {label} have been reconciled. Download the monthly report for your CA.</p>
        <Button size="lg" className="mt-6" onClick={download} disabled={dl}>
          {dl ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Download {label} Report
        </Button>
      </div>
      <div className="flex justify-between"><Button variant="outline" onClick={onBack}><ChevronLeft className="mr-2 size-4" />Back to Review</Button></div>
    </div>
  );
}

/* ── Shared: TxnTable ─────────────────────────────────── */

function TxnTable({ transactions, type, onToggle, onLink, onLinkExpense, onExpense, onSalary, onIgnore, onViewInvoice, onEdit }: {
  transactions: BankTransaction[]; type: "credit" | "debit" | "both";
  onToggle: (id: string, r: boolean) => void; onLink: (t: BankTransaction) => void;
  onLinkExpense?: (t: BankTransaction) => void;
  onExpense: (t: BankTransaction) => void; onSalary: (t: BankTransaction) => void; onIgnore: (t: BankTransaction) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onEdit?: (t: BankTransaction) => void;
}) {
  if (transactions.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No transactions.</p>;
  const ml = (t: string | null) => {
    const m: Record<string, { l: string; c: string }> = {
      invoice: { l: "Invoice", c: "text-emerald-600 border-emerald-200" }, expense: { l: "Expense", c: "text-orange-600 border-orange-200" },
      salary: { l: "Salary", c: "text-blue-600 border-blue-200" }, cashfree_settlement: { l: "Cashfree", c: "text-blue-600 border-blue-200" },
      credit_card_payment: { l: "Card Payment", c: "text-purple-600 border-purple-200" }, ignored: { l: "Ignored", c: "text-muted-foreground border-muted" },
    };
    return t ? m[t] ?? { l: t, c: "" } : null;
  };
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="w-[90px]">Date</TableHead><TableHead>Description</TableHead><TableHead>Source</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Match</TableHead><TableHead className="w-[130px]">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {transactions.map((txn) => { const m = ml(txn.matched_type); return (
            <TableRow key={txn.id}>
              <TableCell className="text-xs tabular-nums text-muted-foreground">{format(new Date(txn.date + "T00:00:00"), "dd MMM")}</TableCell>
              <TableCell className="text-sm max-w-[280px]">
                <p className="truncate">{txn.description}</p>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{txn.bank_name ?? "Bank"}</TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {type === "credit" || (type === "both" && txn.credit > 0) ? <span className="text-emerald-600">+{formatCurrency(txn.credit)}</span> : <span className="text-red-600">-{formatCurrency(txn.debit)}</span>}
              </TableCell>
              <TableCell>
                {m ? (
                  txn.matched_id && (txn.matched_type === "invoice" || txn.matched_type === "cashfree_settlement") ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${m.c} cursor-pointer hover:opacity-80`}
                      onClick={() => onViewInvoice?.(txn.matched_id!)}
                    >{m.l} ↗</Badge>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] ${m.c}`}>{m.l}</Badge>
                  )
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onToggle(txn.id, !txn.reconciled)}>
                    {txn.reconciled ? <CheckCircle2 className="mr-1 size-3 text-emerald-600" /> : <XCircle className="mr-1 size-3 text-muted-foreground" />}
                    {txn.reconciled ? "OK" : "Unmatched"}
                  </Button>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && <DropdownMenuItem onClick={() => onEdit(txn)}><Pencil className="mr-2 size-3.5" />Edit Details</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => onLink(txn)}><Link2 className="mr-2 size-3.5" />Link to Invoice</DropdownMenuItem>
                      {txn.debit > 0 && onLinkExpense && <DropdownMenuItem onClick={() => onLinkExpense(txn)}><Link2 className="mr-2 size-3.5" />Link to Expense</DropdownMenuItem>}
                      {txn.debit > 0 && <DropdownMenuItem onClick={() => onExpense(txn)}><Plus className="mr-2 size-3.5" />Record Bill / Expense</DropdownMenuItem>}
                      {txn.debit > 0 && <DropdownMenuItem onClick={() => onSalary(txn)}><Users className="mr-2 size-3.5" />Record Salary</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => onIgnore(txn)}><EyeOff className="mr-2 size-3.5" />Ignore</DropdownMenuItem>
                      {txn.reconciled && (
                        <DropdownMenuItem className="text-amber-600" onClick={() => onToggle(txn.id, false)}>
                          <XCircle className="mr-2 size-3.5" />Unmatch
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ); })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ── Shared: LinkDialog ───────────────────────────────── */

function LinkDialog({ txn, onClose, onLink }: { txn: BankTransaction; onClose: () => void; onLink: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ invoices: { id: string; invoice_number: string; total: number; status: string; client_name: string }[]; installments: { id: string; invoice_id: string; installment_number: number; amount: number; status: string; invoice_number: string; client_name: string }[] }>({ invoices: [], installments: [] });
  const [loading, setLoading] = useState(false);
  async function doSearch(q: string) {
    setLoading(true); const amt = txn.credit > 0 ? txn.credit : txn.debit; const p = new URLSearchParams();
    if (q) p.set("q", q); if (amt > 0) p.set("amount", String(amt));
    const r = await fetch(`/api/finance/reconciliation/search-invoices?${p}`); if (r.ok) setResults(await r.json()); setLoading(false);
  }
  useState(() => { doSearch(""); });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Link to Invoice</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">{txn.description}</p>
          <p className="text-muted-foreground mt-1">{format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} · <span className="font-mono font-medium">{formatCurrency(txn.credit > 0 ? txn.credit : txn.debit)}</span></p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search client or invoice..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch(search)} className="pl-8" />
          </div>
          <Button variant="outline" size="sm" onClick={() => doSearch(search)} disabled={loading}>{loading ? <Loader2 className="size-3 animate-spin" /> : "Search"}</Button>
        </div>
        {results.invoices.map((inv) => (
          <button key={inv.id} onClick={() => onLink(inv.id)} className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left">
            <div><span className="text-sm font-medium">{inv.invoice_number}</span><span className="text-sm text-muted-foreground ml-2">{inv.client_name}</span></div>
            <div className="flex items-center gap-2"><span className="font-mono text-sm">{formatCurrency(inv.total)}</span><Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[10px]">{inv.status}</Badge></div>
          </button>
        ))}
        {results.installments.map((inst) => (
          <button key={inst.id} onClick={() => onLink(inst.invoice_id)} className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left">
            <div><span className="text-sm font-medium">{inst.invoice_number}</span><span className="text-xs text-muted-foreground ml-1">#{inst.installment_number}</span><span className="text-sm text-muted-foreground ml-2">{inst.client_name}</span></div>
            <div className="flex items-center gap-2"><span className="font-mono text-sm">{formatCurrency(inst.amount)}</span><Badge variant={inst.status === "paid" ? "default" : "secondary"} className="text-[10px]">{inst.status}</Badge></div>
          </button>
        ))}
        {!loading && results.invoices.length === 0 && results.installments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No matching invoices found.</p>}
      </DialogContent>
    </Dialog>
  );
}

/* ── Record Bill / Expense Dialog ──────────────────────── */

const EXPENSE_CATEGORIES = [
  "Advertising", "Software & Tools", "Freelancers & Contractors", "Content Production",
  "Office & Supplies", "Travel & Events", "Communication (Phone/Internet)",
  "Training & Education", "Taxes & Compliance", "Salary & Payroll", "Miscellaneous",
];

const GST_RATES = [
  { label: "No GST", value: 0 },
  { label: "5%", value: 5 },
  { label: "12%", value: 12 },
  { label: "18%", value: 18 },
  { label: "28%", value: 28 },
];

const PAYMENT_MODES_LIST = ["UPI", "Credit Card", "Bank Transfer", "Cash", "Cheque", "Auto-deducted"];

function RecordBillDialog({ txn, vendorGuess, categoryGuess, onClose, onSaved }: {
  txn: BankTransaction;
  vendorGuess: string;
  categoryGuess: string;
  onClose: () => void;
  onSaved: (expenseId: string) => void;
}) {
  const amount = txn.debit > 0 ? txn.debit : txn.credit;
  const isCreditCard = (txn.bank_name ?? "").includes("Credit Card") || txn.description.startsWith("CC:");

  const [vendor, setVendor] = useState(vendorGuess);
  const [category, setCategory] = useState(categoryGuess);
  const [description, setDescription] = useState(txn.description.replace(/^CC:\s*|^UPI-/i, "").trim());
  const [gstRate, setGstRate] = useState(0);
  const [vendorGstin, setVendorGstin] = useState("");
  const [paymentMode, setPaymentMode] = useState(isCreditCard ? "Credit Card" : txn.description.toLowerCase().includes("upi") ? "UPI" : "Bank Transfer");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const gstAmount = gstRate > 0 ? Math.round(amount * (gstRate / 100)) : 0;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        const res = await fetch("/api/finance/upload-attachment", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error ?? `Upload failed for ${files[i].name}`);
        }
        const { url } = await res.json();
        setAttachments((prev) => [...prev, url]);
      }
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cgst = gstRate > 0 ? Math.round(gstAmount / 2) : null;
      const sgst = gstRate > 0 ? gstAmount - (cgst ?? 0) : null;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          category,
          date: txn.date,
          description: `${vendor}${notes ? " - " + notes : ""}`,
          gst_applicable: gstRate > 0,
          gst_rate: gstRate > 0 ? gstRate : null,
          vendor_gstin: vendorGstin || "",
          payment_mode: paymentMode,
          attachment_url: attachments.join(",") || "",
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      onSaved(data.id);
    } catch {
      toast.error("Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Record Bill / Expense</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Bank transaction reference */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm overflow-hidden">
          <p className="font-medium truncate text-xs">{txn.description}</p>
          <p className="text-muted-foreground mt-1">
            {format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} ·{" "}
            <span className="font-mono font-semibold">{formatCurrency(amount)}</span>
            <span className="ml-2 text-xs">via {txn.bank_name ?? "Bank"}</span>
          </p>
        </div>

        <div className="space-y-4">
          {/* Vendor + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vendor / Party Name</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Claude AI, Facebook" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description / Notes</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this payment for?" />
          </div>

          {/* Payment mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Payment Mode</Label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PAYMENT_MODES_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* GST */}
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">GST Details</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">GST Rate</Label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {GST_RATES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor GSTIN</Label>
                <Input className="h-8" value={vendorGstin} onChange={(e) => setVendorGstin(e.target.value)} placeholder="e.g. 29AAHCE..." />
              </div>
            </div>
            {gstRate > 0 && (
              <div className="rounded bg-muted/50 px-3 py-2 text-xs">
                GST @ {gstRate}%: <strong>{gstAmount.toLocaleString("en-IN")}</strong>
                {" "}(CGST: {Math.round(gstAmount / 2).toLocaleString("en-IN")} + SGST: {(gstAmount - Math.round(gstAmount / 2)).toLocaleString("en-IN")})
              </div>
            )}
          </div>

          {/* Attach vendor bill */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Attach Vendor Bill / Invoice (optional)</Label>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <a href={url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline truncate flex-1">
                      Bill {i + 1}
                    </a>
                    <Button type="button" variant="ghost" size="sm" className="h-5 px-1" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label>
              <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                {uploading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Upload className="size-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{attachments.length > 0 ? "Add more files" : "Upload PDF or image"}</span>
              </div>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          {/* Additional notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Additional Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra details..." />
          </div>
        </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !vendor}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
            Save Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Record Salary Dialog ─────────────────────────────── */

function RecordSalaryDialog({ txn, onClose, onSaved }: {
  txn: BankTransaction; onClose: () => void; onSaved: (salaryId: string) => void;
}) {
  const amount = txn.debit > 0 ? txn.debit : txn.credit;
  const descClean = txn.description.replace(/^UPI-/i, "");
  const nameParts = descClean.split("-")[0]?.trim() ?? "";
  const guessedName = nameParts.length > 2 && !nameParts.includes("@") ? nameParts : "";

  const [employees, setEmployees] = useState<{ id: string; name: string; employee_number: string; role: string | null }[]>([]);
  const [employeeName, setEmployeeName] = useState(guessedName);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState(txn.description.toLowerCase().includes("upi") ? "UPI" : "Bank Transfer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch employees
  useState(() => {
    fetch("/api/finance/employees").then((r) => r.json()).then((d) => {
      setEmployees(d.data ?? []);
      // Auto-match by guessed name
      if (guessedName) {
        const match = (d.data ?? []).find((e: { name: string }) =>
          guessedName.toLowerCase().includes(e.name.split(" ")[0].toLowerCase())
        );
        if (match) {
          setEmployeeName(match.name);
          setEmployeeNumber(match.employee_number);
          setNotes(match.role ?? "");
        }
      }
    }).catch(() => {});
  });

  function handleEmployeeSelect(empNumber: string) {
    const emp = employees.find((e) => e.employee_number === empNumber);
    if (emp) {
      setEmployeeName(emp.name);
      setEmployeeNumber(emp.employee_number);
      setNotes(emp.role ?? "");
    }
  }

  async function handleSave() {
    if (!employeeName || !employeeNumber) {
      toast.error("Employee name and number are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/salary-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_name: employeeName,
          employee_number: employeeNumber,
          amount,
          paid_date: txn.date,
          payment_mode: paymentMode,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      // Auto-save employee to master data
      await fetch("/api/finance/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: employeeName, employee_number: employeeNumber, role: notes || null }),
      });

      onSaved(data.data.id);
    } catch {
      toast.error("Failed to save salary");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Salary Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-3 text-sm overflow-hidden">
          <p className="font-medium truncate text-xs">{txn.description}</p>
          <p className="text-muted-foreground mt-1">
            {format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} ·{" "}
            <span className="font-mono font-semibold">{formatCurrency(amount)}</span>
          </p>
        </div>

        <div className="space-y-4 min-w-0">
          {/* Employee selector */}
          {employees.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Select Employee</Label>
              <select
                value={employeeNumber}
                onChange={(e) => handleEmployeeSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm truncate"
              >
                <option value="">Pick saved employee or enter new</option>
                {employees.map((emp) => (
                  <option key={emp.employee_number} value={emp.employee_number}>
                    {emp.name} ({emp.employee_number}){emp.role ? ` · ${emp.role}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Employee Name</Label>
              <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="e.g. Shaik Murad" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Employee Number</Label>
              <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder="e.g. XW01" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Payment Mode</Label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              {PAYMENT_MODES_LIST.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes / Role</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Head of Product & Design" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !employeeName || !employeeNumber}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
            Save Salary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Link to Expense Dialog ────────────────────────────── */

function LinkExpenseDialog({ txn, onClose, onLink }: {
  txn: BankTransaction; onClose: () => void; onLink: (expenseId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; amount: number; date: string; description: string | null; category: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function doSearch(q: string) {
    setLoading(true);
    const amount = txn.debit > 0 ? txn.debit : txn.credit;
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (amount > 0) p.set("amount", String(amount));
    const r = await fetch(`/api/finance/reconciliation/search-expenses?${p}`);
    if (r.ok) { const d = await r.json(); setResults(d.data ?? []); }
    setLoading(false);
  }

  useState(() => { doSearch(""); });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Link to Expense</DialogTitle></DialogHeader>
        <div className="rounded-lg bg-muted/50 p-3 text-sm overflow-hidden">
          <p className="font-medium truncate text-xs">{txn.description}</p>
          <p className="text-muted-foreground mt-1">
            {format(new Date(txn.date + "T00:00:00"), "dd MMM yyyy")} · <span className="font-mono font-medium">{formatCurrency(txn.debit > 0 ? txn.debit : txn.credit)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search by description or category..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch(search)} className="pl-8" />
          </div>
          <Button variant="outline" size="sm" onClick={() => doSearch(search)} disabled={loading}>
            {loading ? <Loader2 className="size-3 animate-spin" /> : "Search"}
          </Button>
        </div>
        {results.map((exp) => (
          <button key={exp.id} onClick={() => onLink(exp.id)} className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left">
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium">{exp.description || exp.category}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{exp.category}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(exp.date + "T00:00:00"), "dd MMM yyyy")}</span>
              </div>
            </div>
            <span className="font-mono text-sm font-medium shrink-0 ml-2">{formatCurrency(exp.amount)}</span>
          </button>
        ))}
        {!loading && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matching expenses found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Wizard ──────────────────────────────────────── */

export function ReconciliationWizard({ batches }: { batches: ReconciliationBatch[] }) {
  const router = useRouter();

  // Check for active batch from URL or most recent incomplete batch
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (typeof window === "undefined") return 1;
    const params = new URLSearchParams(window.location.search);
    if (params.get("batch")) return 2;
    return 1;
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [month, setMonth] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const m = params.get("month");
      if (m) return m;
    }
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get("batch");
    if (batchId) return { batch_id: batchId, total: 0, matched: 0, unmatched: 0 };
    return null;
  });
  const [revertId, setRevertId] = useState<string | null>(null);

  // Save batch to URL when entering Step 2
  function goToStep(s: 1 | 2 | 3, batchId?: string) {
    setStep(s);
    const params = new URLSearchParams(window.location.search);
    if (s === 2 && batchId) {
      params.set("batch", batchId);
      params.set("month", month);
    } else if (s === 1) {
      params.delete("batch");
    }
    router.replace(`/finance/reconciliation?${params.toString()}`);
  }

  async function handleReconcile() {
    setProcessing(true);
    try {
      const bf = files.find((f) => f.type === "bank"), cf = files.find((f) => f.type === "cashfree"),
        sf = files.find((f) => f.type === "settlement"), ccf = files.find((f) => f.type === "card");
      const br = bf ? parseBankCSV(await bf.file.text()) : undefined;
      const cr = cf ? parseCashfreeCSV(await cf.file.text()) : undefined;
      const sr = sf ? parseSettlementCSV(await sf.file.text()) : undefined;
      const ccr = ccf ? parseCardCSV(await ccf.file.text()) : undefined;

      // Upload files for record-keeping
      for (const f of files) {
        if (f.type === "unknown") continue;
        const fd = new FormData(); fd.append("file", f.file);
        await fetch("/api/finance/upload-attachment", { method: "POST", body: fd });
      }

      const res = await fetch("/api/finance/reconciliation/wizard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, bank_rows: br, cashfree_rows: cr, settlement_rows: sr, card_rows: ccr }),
      });
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error ?? "Failed"); }
      const data = await res.json();
      setResult(data); goToStep(2, data.batch_id); router.refresh();
      toast.success(`Matched ${data.matched} of ${data.total} transactions`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Reconciliation failed"); }
    finally { setProcessing(false); }
  }

  async function revertBatch(id: string) {
    await fetch(`/api/finance/reconciliation/${id}`, { method: "DELETE" });
    toast.success("Import reverted"); setRevertId(null); router.refresh();
  }

  const steps = [{ n: 1, l: "Upload Files" }, { n: 2, l: "Review & Match" }, { n: 3, l: "Generate Report" }];

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${step === s.n ? "bg-primary text-primary-foreground" : step > s.n ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {step > s.n ? <CheckCircle2 className="size-4" /> : <span className="size-5 rounded-full border flex items-center justify-center text-xs">{s.n}</span>}{s.l}
            </div>
            {i < steps.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {processing && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-10 animate-spin text-primary mb-4" />
          <p className="text-sm font-medium">Reconciling transactions...</p>
          <p className="text-xs text-muted-foreground mt-1">Matching invoices, expenses, salaries, and Cashfree settlements</p>
        </div>
      )}

      {!processing && step === 1 && (
        <>
          <StepUpload files={files} onAddFiles={(f) => setFiles((p) => [...p, ...f])} onRemoveFile={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} month={month} onMonthChange={setMonth} onNext={handleReconcile} />
          {batches.length > 0 && (
            <div className="space-y-3 border-t pt-6">
              <h3 className="text-sm font-semibold">Previous Reconciliations</h3>
              <div className="rounded-lg border"><Table><TableHeader><TableRow>
                <TableHead>Month</TableHead><TableHead>Total</TableHead><TableHead>Matched</TableHead><TableHead>Unmatched</TableHead><TableHead className="w-20" />
              </TableRow></TableHeader><TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{new Date(b.year, parseInt(b.month) - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</TableCell>
                    <TableCell>{b.total_count}</TableCell>
                    <TableCell className="text-emerald-600">{b.matched_count}</TableCell>
                    <TableCell className="text-amber-600">{b.unmatched_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {b.file_url && <a href={b.file_url} target="_blank" rel="noopener"><Button variant="ghost" size="sm" className="text-xs h-7"><FileSpreadsheet className="size-3" /></Button></a>}
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => setRevertId(b.id)}>Revert</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody></Table></div>
            </div>
          )}
        </>
      )}

      {!processing && step === 2 && result && <StepReview batchId={result.batch_id} onBack={() => goToStep(1)} onNext={() => setStep(3)} />}
      {!processing && step === 3 && <StepExport month={month} onBack={() => setStep(2)} />}

      <ConfirmDialog open={!!revertId} onOpenChange={(o) => { if (!o) setRevertId(null); }}
        title="Revert Import" description="This will permanently delete all transactions from this import. This cannot be undone."
        onConfirm={() => revertId && revertBatch(revertId)} destructive />
    </div>
  );
}
