"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ------------------------------------------------------------------ */
/*  CSV Parsers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse CSV respecting quoted fields (handles commas inside quotes).
 */
function parseQuotedCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseSettlementCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detect if this is a Cashfree Transaction Report or Settlement Recon Report
  const headerLine = lines[0].toLowerCase();
  const isTransactionReport = headerLine.includes("order id") && headerLine.includes("service charge");
  const isSettlementReport = headerLine.includes("total transaction amount") && headerLine.includes("net settlement amount");

  const headers = parseQuotedCSVLine(lines[0]).map((h) => h.toLowerCase());

  const rows: {
    settlement_id: string;
    settlement_date: string;
    order_id: string;
    order_amount: number;
    settlement_amount: number;
    service_charge: number;
    service_tax: number;
    adjustment: number;
    utr: string;
  }[] = [];

  const findCol = (keywords: string[]) =>
    headers.findIndex((h) => keywords.some((k) => h.includes(k)));

  if (isTransactionReport) {
    // Cashfree Transaction Report columns:
    // Order Id, Reference Id, Customer Name, ..., Amount, Service Charge, ST/GST,
    // Settlement Amount, ..., UTR No., Settled On, ...
    const idxOrderId = findCol(["order id"]);
    const idxAmount = findCol(["amount"]);
    const idxServiceCharge = findCol(["service charge"]);
    const idxServiceTax = findCol(["st/gst", "service tax"]);
    const idxSettleAmount = findCol(["settlement amount"]);
    const idxUtr = findCol(["utr no", "utr"]);
    const idxSettledOn = findCol(["settled on"]);
    const idxStatus = findCol(["transaction status"]);
    // "settlement" column (SETTLED/NOT_SETTLED) — must match exactly, not "settlement amount"
    const idxSettlement = headers.findIndex((h) => h === "settlement");

    for (let i = 1; i < lines.length; i++) {
      const cells = parseQuotedCSVLine(lines[i]);

      // Only process settled, successful transactions
      const status = idxStatus >= 0 ? cells[idxStatus] ?? "" : "";
      const settlement = idxSettlement >= 0 ? cells[idxSettlement] ?? "" : "";
      if (status.toUpperCase() !== "SUCCESS") continue;
      if (settlement.toUpperCase() !== "SETTLED") continue;

      const parseNum = (idx: number) => {
        if (idx < 0 || !cells[idx]) return 0;
        return parseFloat(cells[idx].replace(/,/g, "")) || 0;
      };

      const settledOn = idxSettledOn >= 0 ? cells[idxSettledOn] ?? "" : "";
      // Parse "2026-04-08 17:34:30" → "2026-04-08"
      const settlementDate = settledOn.split(" ")[0] || "";

      const utr = idxUtr >= 0 ? cells[idxUtr] ?? "" : "";
      const orderId = idxOrderId >= 0 ? cells[idxOrderId] ?? "" : "";
      const orderAmount = parseNum(idxAmount);
      const settleAmount = parseNum(idxSettleAmount);

      if (orderAmount === 0 && settleAmount === 0) continue;

      rows.push({
        settlement_id: utr || `S${i}`, // Group by UTR (same UTR = same bank entry)
        settlement_date: settlementDate,
        order_id: orderId,
        order_amount: orderAmount,
        settlement_amount: settleAmount || orderAmount,
        service_charge: parseNum(idxServiceCharge),
        service_tax: parseNum(idxServiceTax),
        adjustment: 0,
        utr,
      });
    }
  } else if (isSettlementReport) {
    // Settlement Recon Report columns:
    // Id, Total Transaction Amount, Settlement Amount, Adjustment,
    // Net Settlement Amount, From, Till, Status, UTR No., Settlement Date, ...
    const idxId = findCol(["id"]);
    const idxTotalAmount = findCol(["total transaction amount"]);
    const idxSettleAmount = findCol(["settlement amount"]);
    const idxAdjustment = findCol(["adjustment"]);
    const idxNetAmount = findCol(["net settlement amount"]);
    const idxUtr = findCol(["utr no", "utr"]);
    const idxSettleDate = findCol(["settlement date"]);
    const idxSettleCharge = findCol(["settlement charge"]);
    const idxSettleTax = findCol(["settlement tax"]);

    for (let i = 1; i < lines.length; i++) {
      const cells = parseQuotedCSVLine(lines[i]);

      const parseNum = (idx: number) => {
        if (idx < 0 || !cells[idx]) return 0;
        return parseFloat(cells[idx].replace(/,/g, "")) || 0;
      };

      const settleDate = idxSettleDate >= 0 ? (cells[idxSettleDate] ?? "").split(" ")[0] : "";
      const totalAmount = parseNum(idxTotalAmount);
      const netAmount = parseNum(idxNetAmount);
      if (totalAmount === 0 && netAmount === 0) continue;

      rows.push({
        settlement_id: idxId >= 0 ? cells[idxId] ?? `S${i}` : `S${i}`,
        settlement_date: settleDate,
        order_id: "", // Settlement report doesn't have order IDs
        order_amount: totalAmount,
        settlement_amount: parseNum(idxSettleAmount),
        service_charge: parseNum(idxSettleCharge),
        service_tax: parseNum(idxSettleTax),
        adjustment: parseNum(idxAdjustment),
        utr: idxUtr >= 0 ? cells[idxUtr] ?? "" : "",
      });
    }
  } else {
    // Generic fallback
    const idxOrderId = findCol(["order id", "order_id"]);
    const idxAmount = findCol(["amount", "order amount"]);
    const idxSettleAmount = findCol(["settlement amount", "net amount"]);
    const idxServiceCharge = findCol(["service charge", "fee"]);
    const idxServiceTax = findCol(["service tax", "gst"]);
    const idxUtr = findCol(["utr", "bank ref"]);
    const idxDate = findCol(["settled on", "settlement date", "date"]);

    for (let i = 1; i < lines.length; i++) {
      const cells = parseQuotedCSVLine(lines[i]);

      const parseNum = (idx: number) => {
        if (idx < 0 || !cells[idx]) return 0;
        return parseFloat(cells[idx].replace(/,/g, "")) || 0;
      };

      const amount = parseNum(idxAmount);
      const settleAmount = parseNum(idxSettleAmount);
      if (amount === 0 && settleAmount === 0) continue;

      const dateVal = idxDate >= 0 ? (cells[idxDate] ?? "").split(" ")[0] : "";

      rows.push({
        settlement_id: `S${i}`,
        settlement_date: dateVal,
        order_id: idxOrderId >= 0 ? cells[idxOrderId] ?? "" : "",
        order_amount: amount,
        settlement_amount: settleAmount || amount,
        service_charge: parseNum(idxServiceCharge),
        service_tax: parseNum(idxServiceTax),
        adjustment: 0,
        utr: idxUtr >= 0 ? cells[idxUtr] ?? "" : "",
      });
    }
  }

  return rows;
}

function parseCardCSV(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: {
    date: string;
    description: string;
    amount: number;
    type: "debit" | "credit";
    reference?: string;
  }[] = [];

  // HDFC credit card statements use ~|~ as delimiter
  // Format: Transaction type~|~Name~|~DATE~|~Description~|~AMT~|~Debit/Credit~|~REWARDS
  const isHDFCCard = text.includes("~|~");

  if (isHDFCCard) {
    // Find the transaction header row
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("transaction type") && lower.includes("date") && lower.includes("amt")) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) return [];

    const headers = lines[headerIdx].split("~|~").map((h) => h.trim().toLowerCase());
    const findCol = (keywords: string[]) =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    const idxDate = findCol(["date"]);
    const idxDesc = findCol(["description"]);
    const idxAmount = findCol(["amt", "amount"]);
    const idxDrCr = findCol(["debit", "credit"]);

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("~|~")) continue;

      const cells = line.split("~|~").map((c) => c.trim());

      // Stop at non-transaction rows (like "Opening Balance", "Programs", etc.)
      const firstCell = cells[0]?.toLowerCase() ?? "";
      if (!firstCell.includes("domestic") && !firstCell.includes("international")) continue;

      const dateVal = idxDate >= 0 ? cells[idxDate] ?? "" : "";
      if (!dateVal || !dateVal.match(/\d{2}\/\d{2}\/\d{4}/)) continue;

      // Parse date — "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY 00:00:00"
      const datePart = dateVal.split(" ")[0];
      const [d, m, y] = datePart.split("/");
      const parsedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

      const amountStr = idxAmount >= 0 ? cells[idxAmount] ?? "" : "";
      const amount = parseFloat(amountStr.replace(/,/g, "")) || 0;
      if (amount === 0) continue;

      // HDFC: empty Debit/Credit column = debit (charge), "CR" = credit (refund)
      const drCrVal = idxDrCr >= 0 ? (cells[idxDrCr] ?? "").toLowerCase().trim() : "";
      const isCredit = drCrVal.includes("cr") || drCrVal.includes("credit");

      const descVal = idxDesc >= 0 ? cells[idxDesc] ?? "" : "";

      // Skip IGST rows and fee rows (they're supplementary, not actual purchases)
      if (descVal.startsWith("IGST-") || descVal.includes("CONSOLIDATED FCY")) continue;

      rows.push({
        date: parsedDate,
        description: descVal,
        amount,
        type: isCredit ? "credit" : "debit",
      });
    }
  } else {
    // Standard comma-delimited CSV
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

    const findCol = (keywords: string[]) =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    const idxDate = findCol(["date", "transaction date", "txn date"]);
    const idxDesc = findCol(["description", "narration", "particulars", "details", "merchant"]);
    const idxAmount = findCol(["amount", "transaction amount", "debit"]);
    const idxType = findCol(["type", "dr/cr", "debit/credit"]);
    const idxRef = findCol(["reference", "ref", "auth code"]);

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));

      const dateVal = idxDate >= 0 ? cells[idxDate] ?? "" : cells[0] ?? "";
      let parsedDate = dateVal;
      if (dateVal.includes("/")) {
        const parts = dateVal.split("/");
        if (parts.length === 3) {
          const [dd, mm, yy] = parts;
          parsedDate = `${yy.length === 2 ? "20" + yy : yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
      }

      const amount = parseFloat((idxAmount >= 0 ? cells[idxAmount] ?? "" : "").replace(/,/g, "")) || 0;
      if (amount === 0) continue;

      const typeVal = idxType >= 0 ? (cells[idxType] ?? "").toLowerCase() : "debit";
      const isCredit = typeVal.includes("cr") || typeVal.includes("credit") || typeVal.includes("refund");

      rows.push({
        date: parsedDate,
        description: idxDesc >= 0 ? cells[idxDesc] ?? "" : cells[1] ?? "",
        amount,
        type: isCredit ? "credit" : "debit",
        reference: idxRef >= 0 ? cells[idxRef] : undefined,
      });
    }
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SettlementImport() {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [createUnmatched, setCreateUnmatched] = useState(false);

  const [settlementResult, setSettlementResult] = useState<{
    settlements: number;
    orders: number;
    matched: number;
    unmatched: number;
    details: {
      settlement_id: string;
      total_amount: number;
      orders: { order_id: string; amount: number; matched: boolean; invoice_number?: string }[];
      utr: string;
    }[];
  } | null>(null);

  const [cardResult, setCardResult] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    created: number;
    details: {
      description: string;
      amount: number;
      date: string;
      matched: boolean;
      matched_expense?: string;
      created?: boolean;
    }[];
  } | null>(null);

  const handleSettlementUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("settlement");
    try {
      const text = await file.text();
      const rows = parseSettlementCSV(text);

      if (rows.length === 0) {
        toast.error("No valid settlement rows found");
        return;
      }

      // Upload file for record-keeping
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/finance/upload-attachment", {
        method: "POST",
        body: uploadForm,
      });
      const fileUrl = uploadRes.ok ? (await uploadRes.json()).url : null;

      const res = await fetch("/api/finance/settlement-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, month, file_url: fileUrl }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? `Import failed (${res.status})`);
      }
      const data = await res.json();
      setSettlementResult(data);
      toast.success(`Matched ${data.matched} of ${data.orders} orders across ${data.settlements} settlements`);
      router.refresh();
    } catch {
      toast.error("Failed to process settlement file");
    } finally {
      setUploading(null);
    }
  }, [month, router]);

  const handleCardUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("card");
    try {
      const text = await file.text();
      const rows = parseCardCSV(text);

      if (rows.length === 0) {
        toast.error("No valid card transactions found");
        return;
      }

      // Upload file for record-keeping
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const uploadRes = await fetch("/api/finance/upload-attachment", {
        method: "POST",
        body: uploadForm,
      });
      const fileUrl = uploadRes.ok ? (await uploadRes.json()).url : null;

      const res = await fetch("/api/finance/card-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, month, create_unmatched: createUnmatched, file_url: fileUrl }),
      });

      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setCardResult(data);
      toast.success(`Matched ${data.matched} of ${data.total} charges`);
      router.refresh();
    } catch {
      toast.error("Failed to process card statement");
    } finally {
      setUploading(null);
    }
  }, [month, createUnmatched, router]);

  return (
    <div className="space-y-4">
      {/* Month selector shared between both imports */}
      <div className="flex items-center gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      <Tabs defaultValue="cashfree">
        <TabsList>
          <TabsTrigger value="cashfree">
            <Landmark className="mr-1.5 size-3.5" />
            Cashfree Settlements
          </TabsTrigger>
          <TabsTrigger value="card">
            <CreditCard className="mr-1.5 size-3.5" />
            Credit Card Statement
          </TabsTrigger>
        </TabsList>

        {/* Cashfree Settlement Tab */}
        <TabsContent value="cashfree" className="mt-4 space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Cashfree Import</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload either the <strong>Transaction Report</strong> (recommended — has Order IDs for
                  direct invoice matching) or <strong>Settlement Recon Report</strong> (matches by amount).
                  PG fees are auto-logged as expenses.
                </p>
              </div>
              <label>
                <Button variant="outline" disabled={uploading === "settlement"} asChild>
                  <span>
                    {uploading === "settlement" ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4" />
                    )}
                    Upload Cashfree CSV
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleSettlementUpload}
                  disabled={!!uploading}
                />
              </label>
            </div>
          </div>

          {settlementResult && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Settlements" value={settlementResult.settlements} format="number" index={0} />
                <StatCard label="Total Orders" value={settlementResult.orders} format="number" index={1} />
                <StatCard label="Matched" value={settlementResult.matched} format="number" color="emerald" index={2} />
                <StatCard label="Unmatched" value={settlementResult.unmatched} format="number" color="amber" index={3} />
              </div>

              <Accordion type="multiple" className="rounded-lg border">
                {settlementResult.details.map((s) => (
                  <AccordionItem key={s.settlement_id} value={s.settlement_id}>
                    <AccordionTrigger className="px-4 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs">{s.settlement_id}</span>
                        <span className="font-medium">{formatCurrency(s.total_amount)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {s.orders.filter((o) => o.matched).length}/{s.orders.length} matched
                        </Badge>
                        {s.utr && (
                          <span className="text-xs text-muted-foreground">UTR: {s.utr}</span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order ID</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {s.orders.map((o, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(o.amount)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {o.invoice_number ?? "—"}
                              </TableCell>
                              <TableCell>
                                {o.matched ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                    <CheckCircle2 className="size-3" /> Matched
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                    <XCircle className="size-3" /> Unmatched
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </TabsContent>

        {/* Credit Card Tab */}
        <TabsContent value="card" className="mt-4 space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Credit Card Statement Import</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload your credit card statement CSV. Charges will be matched against your
                  logged expenses by amount and date (±3 days).
                </p>
              </div>
              <label>
                <Button variant="outline" disabled={uploading === "card"} asChild>
                  <span>
                    {uploading === "card" ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 size-4" />
                    )}
                    Upload Card CSV
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCardUpload}
                  disabled={!!uploading}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={createUnmatched} onCheckedChange={setCreateUnmatched} />
              <Label className="text-xs">Auto-create expenses for unmatched charges</Label>
            </div>
          </div>

          {cardResult && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Charges" value={cardResult.total} format="number" index={0} />
                <StatCard label="Matched" value={cardResult.matched} format="number" color="emerald" index={1} />
                <StatCard label="Unmatched" value={cardResult.unmatched} format="number" color="amber" index={2} />
                <StatCard label="Auto-Created" value={cardResult.created} format="number" color="blue" index={3} />
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Matched To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cardResult.details.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {d.date}
                        </TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">
                          {d.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {formatCurrency(d.amount)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.matched_expense ?? (d.created ? "Auto-created" : "—")}
                        </TableCell>
                        <TableCell>
                          {d.matched ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="size-3" /> Matched
                            </span>
                          ) : d.created ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Created
                            </Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <XCircle className="size-3" /> Unmatched
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
