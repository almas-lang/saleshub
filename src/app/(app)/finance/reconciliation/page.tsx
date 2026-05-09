import { createClient } from "@/lib/supabase/server";
import { ReconciliationWizard } from "@/components/finance/reconciliation-wizard";
import { FinanceNav } from "@/components/finance/finance-nav";

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("reconciliation_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Reconcile bank transactions against invoices, expenses, and salaries.
        </p>
      </div>

      <FinanceNav />

      <ReconciliationWizard batches={batches ?? []} />
    </div>
  );
}
