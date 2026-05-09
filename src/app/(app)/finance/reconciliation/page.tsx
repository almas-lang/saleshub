import { createClient } from "@/lib/supabase/server";
import { ReconciliationView } from "@/components/finance/reconciliation-view";
import { SettlementImport } from "@/components/finance/settlement-import";
import { FinanceNav } from "@/components/finance/finance-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank">Bank Statement</TabsTrigger>
          <TabsTrigger value="settlements">Cashfree & Credit Card</TabsTrigger>
        </TabsList>
        <TabsContent value="bank" className="mt-4">
          <ReconciliationView batches={batches ?? []} />
        </TabsContent>
        <TabsContent value="settlements" className="mt-4">
          <SettlementImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
