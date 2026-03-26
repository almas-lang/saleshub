"use client";

import { Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PnLReportView } from "@/components/finance/pnl-report";
import { GSTReportView } from "@/components/finance/gst-report";
import { RevenueReportView } from "@/components/finance/revenue-report";
import { FinanceNav } from "@/components/finance/finance-nav";

export default function ReportsPage() {
  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            P&L, GST, and revenue reports with export options.
          </p>
        </div>
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
