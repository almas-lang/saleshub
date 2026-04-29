import { createClient } from "@/lib/supabase/server";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  // Initial set of contacts for the client selector;
  // the picker fetches more results on search via /api/contacts/search.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company_name")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("first_name", { ascending: true })
    .limit(50);

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
