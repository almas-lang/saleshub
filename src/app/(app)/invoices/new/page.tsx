import { createClient } from "@/lib/supabase/server";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  // Fetch all contacts for the client selector
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_name")
    .is("deleted_at", null)
    .order("first_name", { ascending: true });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">New Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Create a new invoice and send it to your client.
        </p>
      </div>
      <InvoiceBuilder contacts={contacts ?? []} />
    </div>
  );
}
