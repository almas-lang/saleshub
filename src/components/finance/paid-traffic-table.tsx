"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { safeFetch } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaidTrafficDayRow } from "@/types/paid-traffic";

interface Props {
  rows: PaidTrafficDayRow[];
  totals: PaidTrafficDayRow;
  months: { value: string; label: string }[];
  currentMonth: string;
}

// Editable fields — raw data columns that the user can override
const EDITABLE_FIELDS = new Set<keyof PaidTrafficDayRow>([
  "adSpend",
  "impressions",
  "reach",
  "clicks",
  "leads",
  "apps",
  "calls",
  "sales",
  "revenue",
  "cash",
]);

// Column definitions matching the Excel spreadsheet
const COLUMNS: {
  key: keyof PaidTrafficDayRow;
  label: string;
  format: (v: number) => string;
  colorCode?: boolean;
  group: "ad" | "funnel" | "bottom";
}[] = [
  { key: "adSpend", label: "Adspend", format: (v) => fmtCur(v), group: "ad" },
  { key: "impressions", label: "Impr", format: (v) => fmtNum(v), group: "ad" },
  { key: "reach", label: "Reach", format: (v) => fmtNum(v), group: "ad" },
  { key: "cpm", label: "CPM", format: (v) => fmtDec(v), group: "ad" },
  { key: "clicks", label: "Clicks", format: (v) => fmtNum(v), group: "ad" },
  { key: "ctr", label: "CTR %", format: (v) => fmtPct(v), group: "ad" },
  { key: "cpc", label: "CPC", format: (v) => fmtDec(v), group: "ad" },
  { key: "leads", label: "Leads", format: (v) => fmtNum(v), group: "funnel" },
  { key: "leadCost", label: "Lead Cost", format: (v) => fmtDec(v), group: "funnel" },
  { key: "lpCr", label: "LP CR%", format: (v) => fmtPct(v), group: "funnel" },
  { key: "apps", label: "Apps", format: (v) => fmtNum(v), group: "funnel" },
  { key: "appCost", label: "App Cost", format: (v) => fmtDec(v), group: "funnel" },
  { key: "appPercent", label: "App %", format: (v) => fmtPct(v), group: "funnel" },
  { key: "calls", label: "Calls", format: (v) => fmtNum(v), group: "bottom" },
  { key: "callCost", label: "Call Cost", format: (v) => fmtDec(v), group: "bottom" },
  { key: "callPercent", label: "Call %", format: (v) => fmtPct(v), group: "bottom" },
  { key: "sales", label: "Sales", format: (v) => fmtNum(v), group: "bottom" },
  { key: "conversionPercent", label: "Conv %", format: (v) => fmtPct(v), group: "bottom" },
  { key: "revenue", label: "Revenue", format: (v) => fmtCur(v), group: "bottom" },
  { key: "cash", label: "Cash", format: (v) => fmtCur(v), group: "bottom" },
  { key: "cpa", label: "CPA", format: (v) => fmtDec(v), group: "bottom" },
  { key: "rPnL", label: "R-P/L", format: (v) => fmtCur(v), colorCode: true, group: "bottom" },
  { key: "cPnL", label: "C-P/L", format: (v) => fmtCur(v), colorCode: true, group: "bottom" },
  { key: "rRoi", label: "R-ROI%", format: (v) => fmtPct(v), colorCode: true, group: "bottom" },
  { key: "cRoi", label: "C-ROI%", format: (v) => fmtPct(v), colorCode: true, group: "bottom" },
];

function fmtNum(v: number) {
  return v.toLocaleString("en-IN");
}
function fmtDec(v: number) {
  return v.toFixed(2);
}
function fmtPct(v: number) {
  return v > 0 ? `${v.toFixed(1)}%` : "—";
}
function fmtCur(v: number) {
  if (v === 0) return "—";
  return formatCurrency(Math.round(v));
}

function formatRowDate(date: string) {
  if (date === "Total") return "Total";
  return format(parseISO(date), "dd MMM");
}

function exportToCsv(rows: PaidTrafficDayRow[], totals: PaidTrafficDayRow) {
  const headers = ["Date", ...COLUMNS.map((c) => c.label)];
  const allRows = [totals, ...rows];
  const csvRows = allRows.map((row) => {
    const dateStr = row.date === "Total" ? "Total" : row.date;
    return [dateStr, ...COLUMNS.map((c) => (row[c.key] as number).toString())];
  });

  const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paid-traffic-${rows[0]?.date ?? "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Inline Edit Cell ──

function EditableCell({
  date,
  field,
  value,
  displayValue,
  colorClass,
  isEditable,
}: {
  date: string;
  field: string;
  value: number;
  displayValue: string;
  colorClass?: string;
  isEditable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function handleSave() {
    const newVal = parseFloat(inputVal);
    if (isNaN(newVal)) {
      setEditing(false);
      return;
    }
    if (newVal === value) {
      setEditing(false);
      return;
    }

    const result = await safeFetch("/api/finance/paid-traffic-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        field,
        originalValue: value,
        overrideValue: newVal,
      }),
    });

    if (result.ok) {
      toast.success(`Updated ${field} for ${formatRowDate(date)}`);
      router.refresh();
    } else {
      toast.error("Failed to save override");
    }
    setEditing(false);
  }

  if (!isEditable || date === "Total") {
    return (
      <span className={colorClass}>{displayValue}</span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 rounded border border-primary bg-background px-1.5 py-0.5 text-right font-mono text-sm outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setInputVal(String(value));
        setEditing(true);
      }}
      className={cn(
        "group/edit inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-muted transition-colors",
        colorClass
      )}
      title="Click to edit"
    >
      <span>{displayValue}</span>
      <Pencil className="size-2.5 opacity-0 group-hover/edit:opacity-50 transition-opacity" />
    </button>
  );
}

// ── Main Component ──

export function PaidTrafficTable({ rows, totals, months, currentMonth }: Props) {
  const router = useRouter();
  const hasData = totals.adSpend > 0 || totals.leads > 0;

  return (
    <div className="space-y-4">
      {/* Month tabs + export */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {months.map((m) => (
            <button
              key={m.value}
              onClick={() => router.push(`/finance/paid-traffic?month=${m.value}`)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                m.value === currentMonth
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(rows, totals)}
          disabled={!hasData}
        >
          <Download className="mr-1.5 size-3.5" />
          CSV
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Adspend" value={formatCurrency(totals.adSpend)} />
        <KpiCard label="Leads" value={fmtNum(totals.leads)} sub={`@ ${fmtDec(totals.leadCost)}`} />
        <KpiCard label="Bookings" value={fmtNum(totals.apps)} sub={`${fmtPct(totals.appPercent)} of leads`} />
        <KpiCard label="Sales" value={fmtNum(totals.sales)} sub={`CPA ${fmtDec(totals.cpa)}`} />
        <KpiCard label="Revenue" value={formatCurrency(totals.revenue)} />
        <KpiCard
          label="ROI"
          value={totals.adSpend > 0 ? `${totals.rRoi.toFixed(0)}%` : "—"}
          positive={totals.rPnL >= 0}
        />
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        <Pencil className="inline size-3 mr-1" />
        Click any raw data cell to override. Original values are preserved.
      </p>

      {/* The spreadsheet table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 z-10 bg-muted/50 min-w-[80px]">Date</TableHead>
                {COLUMNS.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "text-right whitespace-nowrap text-xs min-w-[70px]",
                      EDITABLE_FIELDS.has(col.key) && "underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    )}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-semibold border-b-2">
                <TableCell className="sticky left-0 z-10 bg-muted/30 font-bold">
                  Total
                </TableCell>
                {COLUMNS.map((col) => {
                  const val = totals[col.key] as number;
                  return (
                    <TableCell
                      key={col.key}
                      className="text-right font-mono text-sm whitespace-nowrap"
                    >
                      <EditableCell
                        date="Total"
                        field={col.key}
                        value={val}
                        displayValue={col.format(val)}
                        colorClass={cn(
                          col.colorCode && val > 0 && "text-emerald-500",
                          col.colorCode && val < 0 && "text-red-500"
                        )}
                        isEditable={false}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Day rows */}
              {rows.map((row) => {
                const hasAdData = row.adSpend > 0;
                return (
                  <TableRow
                    key={row.date}
                    className={cn(!hasAdData && "opacity-50")}
                  >
                    <TableCell className="sticky left-0 z-10 bg-background font-medium text-sm whitespace-nowrap">
                      {formatRowDate(row.date)}
                    </TableCell>
                    {COLUMNS.map((col) => {
                      const val = row[col.key] as number;
                      const editable = EDITABLE_FIELDS.has(col.key);
                      return (
                        <TableCell
                          key={col.key}
                          className="text-right font-mono text-sm whitespace-nowrap"
                        >
                          <EditableCell
                            date={row.date}
                            field={col.key}
                            value={val}
                            displayValue={col.format(val)}
                            colorClass={cn(
                              col.colorCode && val > 0 && "text-emerald-500",
                              col.colorCode && val < 0 && "text-red-500"
                            )}
                            isEditable={editable}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 1} className="h-32 text-center text-muted-foreground">
                    No data for this month. Meta ad sync runs daily at 06:30 IST.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          positive === true && "text-emerald-500",
          positive === false && "text-red-500"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
