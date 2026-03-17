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

      <BankImportWizard />
    </div>
  );
}
