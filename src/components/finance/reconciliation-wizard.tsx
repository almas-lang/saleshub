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
  if (text.includes("~|~") && (header.includes("transaction type") || text.includes("Billed"))) return "card";
  if (header.includes("order id") && header.includes("service charge")) return "cashfree";
  if (header.includes("total transaction amount") && header.includes("net settlement amount")) return "settlement";
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
    iSt = fc(["transaction status"]), iSe = headers.findIndex((h) => h === "settlement");
  const rows: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseQuotedCSV(lines[i]);
    if ((iSt >= 0 ? c[iSt] ?? "" : "").toUpperCase() !== "SUCCESS") continue;
    if ((iSe >= 0 ? c[iSe] ?? "" : "").toUpperCase() !== "SETTLED") continue;
    const pn = (idx: number) => idx >= 0 && c[idx] ? parseFloat(c[idx].replace(/,/g, "")) || 0 : 0;
    const so = iSO >= 0 ? (c[iSO] ?? "").split(" ")[0] : "";
    const utr = iU >= 0 ? c[iU] ?? "" : "";
    rows.push({ settlement_id: utr || `S${i}`, settlement_date: so, order_id: iO >= 0 ? c[iO] ?? "" : "", order_amount: pn(iA), settlement_amount: pn(iSA) || pn(iA), service_charge: pn(iSC), service_tax: pn(iST), adjustment: 0, utr });
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
  const rows: { settlement_id: string; settlement_date: string; order_id: string; order_amount: number; settlement_amount: number; service_charge: number; service_tax: number; adjustment: number; utr: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseQuotedCSV(lines[i]);
    const pn = (idx: number) => idx >= 0 && c[idx] ? parseFloat(c[idx].replace(/,/g, "")) || 0 : 0;
    const ta = pn(iTA), na = pn(iNA);
    if (ta === 0 && na === 0) continue;
    rows.push({ settlement_id: iId >= 0 ? c[iId] ?? `S${i}` : `S${i}`, settlement_date: iSD >= 0 ? (c[iSD] ?? "").split(" ")[0] : "", order_id: "", order_amount: ta, settlement_amount: pn(iSA), service_charge: pn(iSCh), service_tax: pn(iSTx), adjustment: pn(iAdj), utr: iU >= 0 ? c[iU] ?? "" : "" });
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
  const [linkTxn, setLinkTxn] = useState<BankTransaction | null>(null);

  async function load() { setLoading(true); const r = await fetch(`/api/finance/reconciliation/${batchId}`); if (r.ok) setData(await r.json()); setLoading(false); }
  useState(() => { load(); });

  async function toggleMatch(id: string, reconciled: boolean) {
    await fetch(`/api/finance/reconciliation/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: id, reconciled }) });
    await load();
  }
  async function createExpense(txn: BankTransaction) {
    const r = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: txn.debit > 0 ? txn.debit : txn.credit, category: "Miscellaneous", date: txn.date, description: txn.description, gst_applicable: false, payment_mode: txn.description.toLowerCase().includes("upi") ? "UPI" : "Bank Transfer" }) });
    if (r.ok) { const d = await r.json(); await fetch(`/api/finance/reconciliation/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction_id: txn.id, reconciled: true, matched_type: "expense", matched_id: d.id }) }); await load(); toast.success("Expense created"); }
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={total} format="number" index={0} />
        <StatCard label="Matched" value={total - data.unmatched.length} format="number" color="emerald" index={1} />
        <StatCard label="Unmatched" value={data.unmatched.length} format="number" color="amber" index={2} />
        <StatCard label="Match Rate" value={total > 0 ? Math.round(((total - data.unmatched.length) / total) * 100) : 0} format="percent" index={3} />
      </div>
      <Tabs defaultValue={data.unmatched.length > 0 ? "unmatched" : "earnings"}>
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
              onToggle={(id, r) => toggleMatch(id, r)} onLink={setLinkTxn} onExpense={createExpense} onIgnore={ignore} />
          </TabsContent>
        ))}
      </Tabs>
      {linkTxn && <LinkDialog txn={linkTxn} onClose={() => setLinkTxn(null)} onLink={(invId) => linkInvoice(linkTxn, invId)} />}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="mr-2 size-4" />Back</Button>
        <Button onClick={onNext}>Generate Report<ChevronRight className="ml-2 size-4" /></Button>
      </div>
    </div>
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

function TxnTable({ transactions, type, onToggle, onLink, onExpense, onIgnore }: {
  transactions: BankTransaction[]; type: "credit" | "debit" | "both";
  onToggle: (id: string, r: boolean) => void; onLink: (t: BankTransaction) => void;
  onExpense: (t: BankTransaction) => void; onIgnore: (t: BankTransaction) => void;
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
              <TableCell className="text-sm max-w-[280px] truncate">{txn.description}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{txn.bank_name ?? "Bank"}</TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {type === "credit" || (type === "both" && txn.credit > 0) ? <span className="text-emerald-600">+{formatCurrency(txn.credit)}</span> : <span className="text-red-600">-{formatCurrency(txn.debit)}</span>}
              </TableCell>
              <TableCell>{m ? <Badge variant="outline" className={`text-[10px] ${m.c}`}>{m.l}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onToggle(txn.id, !txn.reconciled)}>
                    {txn.reconciled ? <CheckCircle2 className="mr-1 size-3 text-emerald-600" /> : <XCircle className="mr-1 size-3 text-muted-foreground" />}
                    {txn.reconciled ? "OK" : "Unmatched"}
                  </Button>
                  {!txn.reconciled && (
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onLink(txn)}><Link2 className="mr-2 size-3.5" />Link to Invoice</DropdownMenuItem>
                        {txn.debit > 0 && <DropdownMenuItem onClick={() => onExpense(txn)}><Plus className="mr-2 size-3.5" />Create Expense</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => onIgnore(txn)}><EyeOff className="mr-2 size-3.5" />Ignore</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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

/* ── Main Wizard ──────────────────────────────────────── */

export function ReconciliationWizard({ batches }: { batches: ReconciliationBatch[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [month, setMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [revertId, setRevertId] = useState<string | null>(null);

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
      setResult(data); setStep(2); router.refresh();
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

      {!processing && step === 2 && result && <StepReview batchId={result.batch_id} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {!processing && step === 3 && <StepExport month={month} onBack={() => setStep(2)} />}

      <ConfirmDialog open={!!revertId} onOpenChange={(o) => { if (!o) setRevertId(null); }}
        title="Revert Import" description="This will permanently delete all transactions from this import. This cannot be undone."
        onConfirm={() => revertId && revertBatch(revertId)} destructive />
    </div>
  );
}
