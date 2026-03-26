import { Info } from "lucide-react";
import { FinanceNav } from "@/components/finance/finance-nav";
import { BankImportWizard } from "@/components/finance/import/bank-import-wizard";

export default function BankImportPage() {
  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Import transactions from your bank statement.
        </p>
      </div>

      <FinanceNav />

      {/* Supported Formats */}
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
        <div>
          <p className="text-sm font-medium">Supported Formats</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CSV (any bank) and XLSX (HDFC, ICICI, SBI, Axis). Ensure dates are
            in DD/MM/YYYY or YYYY-MM-DD format. Max 500 rows per import.
          </p>
        </div>
      </div>

      <BankImportWizard />
    </div>
  );
}
