"use client";

import { useState } from "react";
import { Printer, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PnLReportView } from "@/components/finance/pnl-report";
import { GSTReportView } from "@/components/finance/gst-report";
import { RevenueReportView } from "@/components/finance/revenue-report";
import { FinanceNav } from "@/components/finance/finance-nav";
import { toast } from "sonner";

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [monthlyMonth, setMonthlyMonth] = useState(getDefaultMonth());
  const [yearlyFY, setYearlyFY] = useState(() => {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${fy}-${String(fy + 1).slice(-2)}`;
  });
  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadMonthlyReport() {
    setDownloading("monthly");
    try {
      const res = await fetch(`/api/finance/reports/monthly-xlsx?month=${monthlyMonth}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ?? `${monthlyMonth}-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Monthly report downloaded");
    } catch {
      toast.error("Failed to download report");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadYearlyReport() {
    setDownloading("yearly");
    try {
      const res = await fetch(`/api/finance/reports/yearly-xlsx?fy=${yearlyFY}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ?? `FY-${yearlyFY}-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Yearly report downloaded");
    } catch {
      toast.error("Failed to download report");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            P&L, GST, and revenue reports with export options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Monthly XLSX Download */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="mr-2 size-4" />
                Monthly Report
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Month</Label>
                  <Input
                    type="month"
                    value={monthlyMonth}
                    onChange={(e) => setMonthlyMonth(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Downloads a 3-sheet XLSX (Sales, Expenses, Salary) for the selected month.
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={downloadMonthlyReport}
                  disabled={downloading === "monthly"}
                >
                  {downloading === "monthly" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 size-4" />
                  )}
                  Download XLSX
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Yearly XLSX Download */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="mr-2 size-4" />
                Yearly Report
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Financial Year</Label>
                  <Input
                    value={yearlyFY}
                    onChange={(e) => setYearlyFY(e.target.value)}
                    placeholder="e.g. 2025-26"
                    className="mt-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Full FY report (Apr–Mar) with monthly subtotals across 3 sheets.
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={downloadYearlyReport}
                  disabled={downloading === "yearly"}
                >
                  {downloading === "yearly" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 size-4" />
                  )}
                  Download XLSX
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 size-4" />
            Print
          </Button>
        </div>
      </div>

      <FinanceNav />

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">P&L Statement</TabsTrigger>
          <TabsTrigger value="gst">GST Report</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>
        <TabsContent value="pnl" className="mt-4">
          <PnLReportView />
        </TabsContent>
        <TabsContent value="gst" className="mt-4">
          <GSTReportView />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <RevenueReportView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
