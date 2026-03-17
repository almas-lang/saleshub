"use client";

import { useState, useEffect } from "react";
import { subDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { formatCurrency } from "@/lib/utils";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { ExportDropdown } from "@/components/shared/export-dropdown";
import { useExport } from "@/hooks/use-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GSTReport } from "@/types/finance";

export function GSTReportView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 89),
    to: new Date(),
  });
  const [report, setReport] = useState<GSTReport | null>(null);
  const [loading, setLoading] = useState(true);

  const { exportData, loading: exporting } = useExport({
    type: "gst",
    filters: {
      ...(dateRange?.from && { from: format(dateRange.from, "yyyy-MM-dd") }),
      ...(dateRange?.to && { to: format(dateRange.to, "yyyy-MM-dd") }),
    },
  });

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    fetch(
      `/api/finance/reports/gst?from=${format(dateRange.from, "yyyy-MM-dd")}&to=${format(dateRange.to, "yyyy-MM-dd")}`
    )
      .then((r) => r.json())
      .then(setReport)
      .finally(() => setLoading(false));
  }, [dateRange]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!report) return null;

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(mo) - 1]} ${y}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportDropdown onExport={exportData} loading={exporting} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Output GST
          </p>
          <p className="mt-1 font-mono text-xl font-bold">
            {formatCurrency(report.totalOutput)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Input GST
          </p>
          <p className="mt-1 font-mono text-xl font-bold">
            {formatCurrency(report.totalInput)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Net Payable
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-600">
            {formatCurrency(report.totalNetPayable)}
          </p>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">CGST (9%)</TableHead>
              <TableHead className="text-right">SGST (9%)</TableHead>
              <TableHead className="text-right">IGST (18%)</TableHead>
              <TableHead className="text-right">Input GST</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No GST data for this period
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="text-sm font-medium">
                    {monthLabel(row.month)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(row.outputCGST)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(row.outputSGST)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(row.outputIGST)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-600">
                    {formatCurrency(row.inputGST)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium text-amber-600">
                    {formatCurrency(row.netPayable)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
